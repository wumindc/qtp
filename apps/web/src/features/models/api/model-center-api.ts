import { postGateway, readGatewayList } from '@/lib/api/gateway-client';
import { buildModelPayload, toStatusLabel } from '../model-center-schema';
import type { ModelCenterRecord, ModelFormState, ModelProtocol, ModelProviderRecord, ModelType, ProviderFormState, ProviderType } from '../types';

type GatewayRow = Record<string, unknown>;
const PROVIDER_TYPES: ProviderType[] = ['OPENAI_COMPATIBLE', 'QWEN', 'DEEPSEEK'];
const MODEL_TYPES: ModelType[] = ['LLM', 'EMBEDDING'];
const MODEL_PROTOCOLS: ModelProtocol[] = [
  'OPENAI_CHAT_COMPLETIONS',
  'OPENAI_EMBEDDINGS',
  'DASHSCOPE_COMPATIBLE_CHAT',
  'DASHSCOPE_COMPATIBLE_EMBEDDINGS',
  'DEEPSEEK_CHAT_COMPLETIONS',
];

export interface ModelCenterInitialData {
  models: ModelCenterRecord[];
  providers: ModelProviderRecord[];
}

function toStringField(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function toProviderType(value: unknown): ProviderType {
  return PROVIDER_TYPES.includes(value as ProviderType) ? (value as ProviderType) : 'OPENAI_COMPATIBLE';
}

function toModelType(value: unknown): ModelType {
  return MODEL_TYPES.includes(value as ModelType) ? (value as ModelType) : 'LLM';
}

function toModelProtocol(value: unknown): ModelProtocol {
  return MODEL_PROTOCOLS.includes(value as ModelProtocol) ? (value as ModelProtocol) : 'OPENAI_CHAT_COMPLETIONS';
}

function mapProvider(item: GatewayRow): ModelProviderRecord {
  const providerCode = toStringField(item.providerCode);
  return {
    id: providerCode,
    code: providerCode,
    name: toStringField(item.providerName),
    type: toProviderType(item.providerType),
    baseUrl: toStringField(item.baseUrl),
    apiKey: toStringField(item.apiKey),
    status: item.enabled === false ? '停用' : '启用',
  };
}

function mapModel(item: GatewayRow, providerLookup: Map<string, ModelProviderRecord>): ModelCenterRecord {
  const providerCode = toStringField(item.providerCode);
  const provider = providerLookup.get(providerCode);
  return {
    id: toStringField(item.id),
    name: toStringField(item.modelName),
    provider: providerCode,
    providerName: provider?.name ?? providerCode,
    providerType: provider?.type ?? 'OPENAI_COMPATIBLE',
    modelId: toStringField(item.modelId),
    modelType: toModelType(item.modelType),
    protocol: toModelProtocol(item.protocol),
    parameters: (item.parameters ?? item.parametersJson ?? {}) as ModelCenterRecord['parameters'],
    capabilities: (item.capabilities ?? item.capabilitiesJson ?? {}) as ModelCenterRecord['capabilities'],
    limits: (item.limits ?? item.limitsJson ?? {}) as ModelCenterRecord['limits'],
    status: item.enabled === false ? '停用' : '启用',
  };
}

/**
 * @author codex
 * Loads Model Center records through the existing AI gateway endpoints.
 */
export async function loadModelCenterData(): Promise<ModelCenterInitialData> {
  const [providerPayload, modelPayload] = await Promise.all([
    postGateway<unknown>('ai', '/provider/list.do', { page: { currentPage: 1, linesPerPage: 50 }, data: {} }, { cache: 'no-store' }),
    postGateway<unknown>('ai', '/provider/model/list.do', { page: { currentPage: 1, linesPerPage: 50 }, data: {} }, { cache: 'no-store' }),
  ]);
  const providers = readGatewayList<GatewayRow>(providerPayload).map(mapProvider);
  const providerLookup = new Map(providers.map((provider) => [provider.code, provider]));
  const models = readGatewayList<GatewayRow>(modelPayload).map((item) => mapModel(item, providerLookup));
  return { models, providers };
}

export async function saveProvider(form: ProviderFormState, editingProviderCode?: string) {
  const payload = {
    providerName: form.name.trim(),
    providerType: form.type,
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey.trim(),
    enabled: true,
  };
  if (editingProviderCode) {
    return postGateway<GatewayRow>('ai', '/provider/update.do', { providerCode: editingProviderCode, data: payload });
  }
  return postGateway<GatewayRow>('ai', '/provider/create.do', payload);
}

export async function saveModel(form: ModelFormState, provider: ModelProviderRecord, editingModelId?: string) {
  const payload = buildModelPayload(form, provider);
  if (editingModelId) {
    return postGateway<GatewayRow>('ai', '/provider/model/update.do', { id: editingModelId, data: payload });
  }
  return postGateway<GatewayRow>('ai', '/provider/model/create.do', payload);
}

export async function changeModelStatus(model: ModelCenterRecord) {
  const enabled = model.status !== '启用';
  await postGateway('ai', '/provider/model/change-status.do', { id: model.id, enabled });
  return toStatusLabel(enabled);
}

export async function changeProviderStatus(provider: ModelProviderRecord) {
  const enabled = provider.status !== '启用';
  await postGateway('ai', '/provider/change-status.do', { providerCode: provider.code, enabled });
  return toStatusLabel(enabled);
}

export async function deleteModel(model: ModelCenterRecord) {
  await postGateway('ai', '/provider/model/delete.do', { id: model.id });
}

export async function deleteProvider(provider: ModelProviderRecord) {
  await postGateway('ai', '/provider/delete.do', { providerCode: provider.code });
}

export async function testModel(model: ModelCenterRecord) {
  return postGateway<{ message?: string }>('ai', '/provider/model/test-connection.do', { id: model.id });
}

export async function testProvider(provider: ModelProviderRecord) {
  return postGateway<{ message?: string }>('ai', '/provider/test-connection.do', { providerCode: provider.code });
}

export async function testProviderForm(form: ProviderFormState) {
  return postGateway<{ message?: string }>('ai', '/provider/test-config.do', {
    providerType: form.type,
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey.trim(),
  });
}

export async function testModelForm(form: ModelFormState, provider: ModelProviderRecord) {
  return postGateway<{ message?: string }>('ai', '/provider/model/test-config.do', buildModelPayload(form, provider));
}
