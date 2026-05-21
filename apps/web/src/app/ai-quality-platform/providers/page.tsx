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
      defaultModel: String(item.defaultModel ?? ''),
      status: item.enabled === false ? '停用' : '启用',
    }),
  );
  const providerLookup = new Map(providers.map((provider) => [provider.code, provider]));
  const models = modelData.records.map((item): ModelCenterRecord => {
    const provider = providerLookup.get(String(item.providerCode));
    return {
      id: String(item.modelCode),
      code: String(item.modelCode),
      name: String(item.modelName),
      provider: String(item.providerCode),
      providerName: provider?.name ?? String(item.providerCode),
      providerType: provider?.type ?? 'OPENAI_COMPATIBLE',
      modelId: String(item.modelId),
      purpose: String(item.purpose) as ModelCenterRecord['purpose'],
      context: String(item.contextWindow),
      temperature: String(item.temperature),
      status: item.enabled === false ? '停用' : '启用',
    };
  });

  return <ModelCenterPage initialModels={models} initialProviders={providers} />;
}
