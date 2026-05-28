/**
 * 应用评估配置 API
 * @author codex
 */
import { postGateway, readGatewayList } from '@/lib/api/gateway-client';

type GatewayRow = Record<string, unknown>;
type EvaluationProviderOption = {
  code: string;
  name: string;
  enabled: boolean;
};
type EvaluationModelRow = EvaluationModelOption & {
  enabled: boolean;
  providerEnabled: boolean;
};

export interface AppEvaluationConfig {
  appCode: string;
  configured: boolean;
  modelId: string;
  promptOverrideEnabled: boolean;
  systemPrompt: string;
  customPrompt: string;
  effectivePrompt: string;
  evaluationConcurrency: number;
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
  evaluationConcurrency: number;
}

function readStringField(value: unknown, message: string) {
  if (typeof value !== 'string') throw new Error(message);
  return value;
}

function readRequiredStringField(value: unknown, message: string) {
  const text = readStringField(value, message);
  if (!text.trim()) throw new Error(message);
  return text;
}

function readBooleanField(value: unknown, message: string) {
  if (typeof value !== 'boolean') throw new Error(message);
  return value;
}

function readEvaluationConcurrency(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error('评估配置响应包含非法并发数');
  }
  return value;
}

function mapEvaluationConfig(payload: unknown): AppEvaluationConfig {
  if (!payload || typeof payload !== 'object') throw new Error('评估配置响应格式不正确');
  const row = payload as GatewayRow;
  const configured = readBooleanField(row.configured, '评估配置响应缺少配置状态');
  const modelId = readStringField(row.modelId, '评估配置响应缺少模型 ID');
  if (configured && !modelId.trim()) throw new Error('评估配置响应缺少模型 ID');
  return {
    appCode: readRequiredStringField(row.appCode, '评估配置响应缺少应用编码'),
    configured,
    modelId,
    promptOverrideEnabled: readBooleanField(row.promptOverrideEnabled, '评估配置响应缺少提示词覆盖状态'),
    systemPrompt: readRequiredStringField(row.systemPrompt, '评估配置响应缺少系统提示词'),
    customPrompt: readStringField(row.customPrompt, '评估配置响应缺少覆盖提示词'),
    effectivePrompt: readRequiredStringField(row.effectivePrompt, '评估配置响应缺少生效提示词'),
    evaluationConcurrency: readEvaluationConcurrency(row.evaluationConcurrency),
  };
}

function mapEvaluationProvider(row: GatewayRow): EvaluationProviderOption {
  const code = readRequiredStringField(row.providerCode, '评估模型供应商响应缺少供应商编码');
  return {
    code,
    name: readRequiredStringField(row.providerName, '评估模型供应商响应缺少供应商名称'),
    enabled: readBooleanField(row.enabled, '评估模型供应商响应缺少启停状态'),
  };
}

function readLlmModelType(value: unknown) {
  const modelType = readRequiredStringField(value, '评估模型响应缺少模型类型');
  if (modelType !== 'LLM') throw new Error(`评估模型响应包含非 LLM 模型类型：${modelType}`);
}

function mapEvaluationModel(row: GatewayRow, providers: Map<string, EvaluationProviderOption>): EvaluationModelRow {
  const providerCode = readRequiredStringField(row.providerCode, '评估模型响应缺少模型供应商编码');
  const provider = providers.get(providerCode);
  if (!provider) throw new Error(`评估模型响应包含不存在的模型供应商：${providerCode}`);
  readLlmModelType(row.modelType);
  return {
    id: readRequiredStringField(row.id, '评估模型响应缺少模型记录 ID'),
    name: readRequiredStringField(row.modelName, '评估模型响应缺少模型名称'),
    modelId: readRequiredStringField(row.modelId, '评估模型响应缺少模型 ID'),
    providerCode,
    providerName: provider.name,
    enabled: readBooleanField(row.enabled, '评估模型响应缺少启停状态'),
    providerEnabled: provider.enabled,
  };
}

export async function loadEvaluationConfig(appCode: string): Promise<AppEvaluationConfig> {
  return mapEvaluationConfig(
    await postGateway<unknown>('business', '/app/evaluation-config/detail.do', { appCode }, { cache: 'no-store' }),
  );
}

export async function saveEvaluationConfig(appCode: string, data: SaveEvaluationConfigPayload): Promise<AppEvaluationConfig> {
  return mapEvaluationConfig(await postGateway<unknown>('business', '/app/evaluation-config/save.do', { appCode, data }));
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
    readGatewayList<GatewayRow>(providerPayload).map(mapEvaluationProvider).map((provider) => [provider.code, provider]),
  );
  return readGatewayList<GatewayRow>(modelPayload)
    .map((model) => mapEvaluationModel(model, providers))
    .filter((model) => model.enabled && model.providerEnabled)
    .map(({ enabled, providerEnabled, ...model }) => model);
}
