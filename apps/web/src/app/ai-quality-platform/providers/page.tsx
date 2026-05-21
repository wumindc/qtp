import { loadGatewayRecords } from '../../../features/gateway-server';
import { ModelCenterPage, type ModelCenterRecord, type ModelProviderRecord } from '../../../features/models/model-center-page';

export const dynamic = 'force-dynamic';

export default async function ProvidersPage() {
  const [providerData, modelData] = await Promise.all([
    loadGatewayRecords('ai', '/provider/list.do'),
    loadGatewayRecords('ai', '/provider/model/list.do'),
  ]);
  const providers = providerData.records.map(
    (item): ModelProviderRecord => ({
      id: String(item.providerCode),
      code: String(item.providerCode),
      name: String(item.providerName),
      type: String(item.providerType) as ModelProviderRecord['type'],
      baseUrl: String(item.baseUrl),
      apiKey: String(item.apiKey ?? ''),
      status: item.enabled === false ? '停用' : '启用',
    }),
  );
  const providerLookup = new Map(providers.map((provider) => [provider.code, provider]));
  const models = modelData.records.map((item): ModelCenterRecord => {
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
  });

  return <ModelCenterPage initialModels={models} initialProviders={providers} />;
}
