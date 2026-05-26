/**
 * 应用评估配置 API
 * @author codex
 */
import { postGateway, readGatewayList } from '@/lib/api/gateway-client';

type GatewayRow = Record<string, unknown>;

export interface AppEvaluationConfig {
  appCode: string;
  configured: boolean;
  modelId: string;
  promptOverrideEnabled: boolean;
  systemPrompt: string;
  customPrompt: string;
  effectivePrompt: string;
}

export interface EvaluationModelOption {
  id: string;
  name: string;
  modelId: string;
  providerCode: string;
  providerName: string;
}

export interface SaveEvaluationConfigPayload {
  modelId: string;
  promptOverrideEnabled: boolean;
  customPrompt: string;
}

function toStringField(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

export async function loadEvaluationConfig(appCode: string): Promise<AppEvaluationConfig> {
  return postGateway<AppEvaluationConfig>('business', '/app/evaluation-config/detail.do', { appCode }, { cache: 'no-store' });
}

export async function saveEvaluationConfig(appCode: string, data: SaveEvaluationConfigPayload): Promise<AppEvaluationConfig> {
  return postGateway<AppEvaluationConfig>('business', '/app/evaluation-config/save.do', { appCode, data });
}

export async function loadEvaluationModels(): Promise<EvaluationModelOption[]> {
  const [providerPayload, modelPayload] = await Promise.all([
    postGateway<unknown>('ai', '/provider/list.do', { page: { currentPage: 1, linesPerPage: 100 }, data: {} }, { cache: 'no-store' }),
    postGateway<unknown>('ai', '/provider/model/list.do', {
      page: { currentPage: 1, linesPerPage: 100 },
      data: { modelType: 'LLM' },
    }, { cache: 'no-store' }),
  ]);
  const providers = new Map(
    readGatewayList<GatewayRow>(providerPayload).map((provider) => [
      toStringField(provider.providerCode),
      {
        enabled: provider.enabled !== false,
        name: toStringField(provider.providerName, toStringField(provider.providerCode)),
      },
    ]),
  );
  return readGatewayList<GatewayRow>(modelPayload)
    .filter((model) => {
      const provider = providers.get(toStringField(model.providerCode));
      return model.enabled !== false && provider?.enabled !== false && toStringField(model.modelType, 'LLM') === 'LLM';
    })
    .map((model) => {
      const providerCode = toStringField(model.providerCode);
      return {
        id: toStringField(model.id),
        name: toStringField(model.modelName, toStringField(model.modelId)),
        modelId: toStringField(model.modelId),
        providerCode,
        providerName: providers.get(providerCode)?.name ?? providerCode,
      };
    });
}
