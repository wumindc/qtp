import { postGateway, readGatewayList } from '@/lib/api/gateway-client';
import { buildModelPayload, toStatusLabel } from '../model-center-schema';
import type { ModelCenterRecord, ModelFormState, ModelProviderRecord, ProviderFormState } from '../types';

type GatewayRow = Record<string, unknown>;

export interface ModelCenterInitialData {
  models: ModelCenterRecord[];
  providers: ModelProviderRecord[];
}

function mapProvider(item: GatewayRow): ModelProviderRecord {
  return {
    id: String(item.providerCode),
    code: String(item.providerCode),
    name: String(item.providerName),
    type: String(item.providerType) as ModelProviderRecord['type'],
    baseUrl: String(item.baseUrl),
    apiKey: String(item.apiKey ?? ''),
    status: item.enabled === false ? '停用' : '启用',
  };
}

function mapModel(item: GatewayRow, providerLookup: Map<string, ModelProviderRecord>): ModelCenterRecord {
  const provider = providerLookup.get(String(item.providerCode));
  return {
    id: String(item.id),
    name: String(item.modelName),
    provider: String(item.providerCode),
    providerName: provider?.name ?? String(item.providerCode),
    providerType: provider?.type ?? 'OPENAI_COMPATIBLE',
    modelId: String(item.modelId),
    modelType: String(item.modelType ?? 'LLM') as ModelCenterRecord['modelType'],
    protocol: String(item.protocol ?? 'OPENAI_CHAT_COMPLETIONS') as ModelCenterRecord['protocol'],
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
