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

function readRequiredStringField(value: unknown, message: string) {
  if (typeof value === 'string' && value.trim()) return value;
  throw new Error(message);
}

function readRequiredBooleanField(value: unknown, message: string) {
  if (typeof value === 'boolean') return value;
  throw new Error(message);
}

function readRequiredRecord<TRecord extends object>(value: unknown, missingMessage: string, malformedMessage: string): TRecord {
  if (value === undefined || value === null) throw new Error(missingMessage);
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as TRecord;
  throw new Error(malformedMessage);
}

function readEnum<TValue extends string>(value: unknown, allowed: readonly TValue[], message: string): TValue {
  if (allowed.includes(value as TValue)) return value as TValue;
  throw new Error(`${message}：${String(value)}`);
}

function toProviderType(value: unknown): ProviderType {
  return readEnum(value, PROVIDER_TYPES, '模型中心响应包含不支持的供应商类型');
}

function toModelType(value: unknown): ModelType {
  return readEnum(value, MODEL_TYPES, '模型中心响应包含不支持的模型类型');
}

function toModelProtocol(value: unknown): ModelProtocol {
  return readEnum(value, MODEL_PROTOCOLS, '模型中心响应包含不支持的模型协议');
}

function mapProvider(item: GatewayRow): ModelProviderRecord {
  const providerCode = readRequiredStringField(item.providerCode, '模型中心响应缺少供应商编码');
  const providerType = toProviderType(item.providerType);
  const name = readRequiredStringField(item.providerName, '模型中心响应缺少供应商名称');
  const baseUrl = readRequiredStringField(item.baseUrl, '模型中心响应缺少供应商地址');
  const enabled = readRequiredBooleanField(item.enabled, '模型中心响应缺少供应商启停状态');
  return {
    id: providerCode,
    code: providerCode,
    name,
    type: providerType,
    baseUrl,
    apiKey: '',
    apiKeyConfigured: item.apiKeyConfigured === true,
    status: enabled ? '启用' : '停用',
  };
}

function mapModel(item: GatewayRow, providerLookup: Map<string, ModelProviderRecord>): ModelCenterRecord {
  const providerCode = readRequiredStringField(item.providerCode, '模型中心响应缺少模型供应商编码');
  const provider = providerLookup.get(providerCode);
  if (!provider) throw new Error(`模型中心响应包含不存在的模型供应商：${providerCode}`);
  const id = readRequiredStringField(item.id, '模型中心响应缺少模型记录 ID');
  const name = readRequiredStringField(item.modelName, '模型中心响应缺少模型名称');
  const modelId = readRequiredStringField(item.modelId, '模型中心响应缺少模型 ID');
  const modelType = toModelType(item.modelType);
  const protocol = toModelProtocol(item.protocol);
  const parameters = readRequiredRecord<ModelCenterRecord['parameters']>(item.parameters, '模型中心响应缺少模型参数配置', '模型中心响应模型参数配置不是对象');
  const capabilities = readRequiredRecord<ModelCenterRecord['capabilities']>(item.capabilities, '模型中心响应缺少模型能力配置', '模型中心响应模型能力配置不是对象');
  const limits = readRequiredRecord<ModelCenterRecord['limits']>(item.limits, '模型中心响应缺少模型限制配置', '模型中心响应模型限制配置不是对象');
  const enabled = readRequiredBooleanField(item.enabled, '模型中心响应缺少模型启停状态');
  return {
    id,
    name,
    provider: providerCode,
    providerName: provider.name,
    providerType: provider.type,
    modelId,
    modelType,
    protocol,
    parameters,
    capabilities,
    limits,
    status: enabled ? '启用' : '停用',
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
  const payload: {
    providerName: string;
    providerType: ProviderType;
    baseUrl: string;
    apiKey?: string;
    enabled: boolean;
  } = {
    providerName: form.name.trim(),
    providerType: form.type,
    baseUrl: form.baseUrl.trim(),
    enabled: true,
  };
  const trimmedApiKey = form.apiKey.trim();
  if (!editingProviderCode || trimmedApiKey) payload.apiKey = trimmedApiKey;
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
