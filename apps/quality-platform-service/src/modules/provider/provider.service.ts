import {
  AiInvocationClient,
  type ModelProtocol as InvocationModelProtocol,
  type ProviderInvocationKind,
} from '@ai-quality-platform/ai-invocation-client';
import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';
import { BadRequestException } from '@nestjs/common';

export type ProviderType = 'OPENAI_COMPATIBLE' | 'QWEN' | 'DEEPSEEK';
export type ModelType = 'LLM' | 'EMBEDDING';
export type ModelProtocol =
  | 'OPENAI_CHAT_COMPLETIONS'
  | 'OPENAI_EMBEDDINGS'
  | 'DASHSCOPE_COMPATIBLE_CHAT'
  | 'DASHSCOPE_COMPATIBLE_EMBEDDINGS'
  | 'DEEPSEEK_CHAT_COMPLETIONS';

const PROVIDER_TYPES: readonly ProviderType[] = ['OPENAI_COMPATIBLE', 'QWEN', 'DEEPSEEK'];
const MODEL_TYPES: readonly ModelType[] = ['LLM', 'EMBEDDING'];
const MODEL_PROTOCOLS: readonly ModelProtocol[] = [
  'OPENAI_CHAT_COMPLETIONS',
  'OPENAI_EMBEDDINGS',
  'DASHSCOPE_COMPATIBLE_CHAT',
  'DASHSCOPE_COMPATIBLE_EMBEDDINGS',
  'DEEPSEEK_CHAT_COMPLETIONS',
];

function readEnum<TValue extends string>(value: unknown, allowed: readonly TValue[], message: string): TValue {
  if (allowed.includes(value as TValue)) return value as TValue;
  throw new Error(message);
}

function readProviderType(value: unknown): ProviderType {
  return readEnum(value, PROVIDER_TYPES, '不支持的模型供应商类型');
}

function readModelType(value: unknown): ModelType {
  return readEnum(value, MODEL_TYPES, '不支持的模型类型');
}

function readModelProtocol(value: unknown): ModelProtocol {
  return readEnum(value, MODEL_PROTOCOLS, '不支持的模型协议');
}

export interface ProviderRecord {
  providerCode: string;
  providerName: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

export interface ProviderPublicRecord extends Omit<ProviderRecord, 'apiKey'> {
  apiKey: '';
  apiKeyConfigured: boolean;
}

export interface ProviderCreateRequest {
  providerCode?: string;
  providerName: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  enabled?: boolean;
}

export interface ProviderConfigTestRequest {
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
}

export interface ModelParameters {
  batchSize?: number;
  dimensions?: number;
  encodingFormat?: 'float' | 'base64';
  jsonMode?: boolean;
  maxOutputTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'max';
  stream?: boolean;
  temperature?: number;
  thinkingEnabled?: boolean;
  timeoutMs?: number;
  toolCalling?: boolean;
  topK?: number;
  topP?: number;
}

export interface ModelCapabilities {
  embedding?: boolean;
  jsonMode?: boolean;
  reasoning?: boolean;
  stream?: boolean;
  toolCalling?: boolean;
}

export interface ModelLimits {
  contextWindow?: number;
  embeddingDimensions?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  pricing?: ModelPricing;
}

export interface ModelPricing {
  currency?: 'CNY';
  unit?: 'PER_MILLION_TOKENS';
  normalInputPrice?: number | null;
  cachedInputPrice?: number | null;
  outputPrice?: number | null;
  cacheWriteInputPrice?: number | null;
}

export interface ModelRecord {
  id: string;
  modelName: string;
  providerCode: string;
  modelId: string;
  modelType: ModelType;
  protocol: ModelProtocol;
  parameters: ModelParameters;
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  enabled: boolean;
}

export interface ModelCreateRequest {
  modelName: string;
  providerCode: string;
  modelId: string;
  modelType: ModelType;
  protocol?: ModelProtocol;
  parameters: ModelParameters;
  capabilities: ModelCapabilities;
  limits: ModelLimits;
}

export interface ModelConfigTestRequest extends ModelCreateRequest {}

export interface ModelQuery {
  providerCode?: string;
  modelType?: ModelType;
  keyword?: string;
}

export type ProviderUpdateRequest = Partial<Omit<ProviderRecord, 'providerCode'>>;
export type ModelUpdateRequest = Partial<Omit<ModelRecord, 'id'>>;

type ProviderPrismaClient = {
  aiProvider: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
    findUnique(input: { where: { providerCode: string } }): Promise<unknown | null>;
    create(input: { data: object }): Promise<unknown>;
    update(input: { where: { providerCode: string }; data: object }): Promise<unknown>;
    delete(input: { where: { providerCode: string } }): Promise<unknown>;
  };
  aiModel: {
    findMany(input?: { orderBy?: object }): Promise<unknown[]>;
    findUnique(input: { where: { id: bigint } }): Promise<unknown | null>;
    create(input: { data: object }): Promise<unknown>;
    update(input: { where: { id: bigint }; data: object }): Promise<unknown>;
    delete(input: { where: { id: bigint } }): Promise<unknown>;
  };
};

export interface ProviderDataStore {
  listProviders(): Promise<ProviderRecord[]>;
  listModels(): Promise<ModelRecord[]>;
  findProvider(providerCode: string): Promise<ProviderRecord | null>;
  findModel(id: string): Promise<ModelRecord | null>;
  createProvider(record: ProviderRecord): Promise<ProviderRecord>;
  updateProvider(record: ProviderRecord): Promise<ProviderRecord>;
  deleteProvider(providerCode: string): Promise<ProviderRecord>;
  createModel(record: ModelRecord): Promise<ModelRecord>;
  updateModel(record: ModelRecord): Promise<ModelRecord>;
  deleteModel(id: string): Promise<ModelRecord>;
}

class ProviderDatabase implements ProviderDataStore {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Reads provider and model configuration from MySQL; no provider or model is created implicitly.
   */
  async listProviders(): Promise<ProviderRecord[]> {
    const prisma = await this.prismaPromise;
    const rows = await prisma.aiProvider.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toProvider(row));
  }

  async listModels(): Promise<ModelRecord[]> {
    const prisma = await this.prismaPromise;
    const rows = await prisma.aiModel.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toModel(row));
  }

  async findProvider(providerCode: string): Promise<ProviderRecord | null> {
    const prisma = await this.prismaPromise;
    const row = await prisma.aiProvider.findUnique({ where: { providerCode } });
    return row ? this.toProvider(row) : null;
  }

  async findModel(id: string): Promise<ModelRecord | null> {
    const prisma = await this.prismaPromise;
    const row = await prisma.aiModel.findUnique({ where: { id: BigInt(id) } });
    return row ? this.toModel(row) : null;
  }

  async createProvider(record: ProviderRecord): Promise<ProviderRecord> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.aiProvider.create({ data: record });
    return this.toProvider(saved);
  }

  async updateProvider(record: ProviderRecord): Promise<ProviderRecord> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.aiProvider.update({
      where: { providerCode: record.providerCode },
      data: record,
    });
    return this.toProvider(saved);
  }

  async deleteProvider(providerCode: string): Promise<ProviderRecord> {
    const prisma = await this.prismaPromise;
    const deleted = await prisma.aiProvider.delete({ where: { providerCode } });
    return this.toProvider(deleted);
  }

  async createModel(record: ModelRecord): Promise<ModelRecord> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.aiModel.create({ data: this.toModelWriteData(record) });
    return this.toModel(saved);
  }

  async updateModel(record: ModelRecord): Promise<ModelRecord> {
    const prisma = await this.prismaPromise;
    const saved = await prisma.aiModel.update({
      where: { id: BigInt(record.id) },
      data: this.toModelWriteData(record),
    });
    return this.toModel(saved);
  }

  async deleteModel(id: string): Promise<ModelRecord> {
    const prisma = await this.prismaPromise;
    const deleted = await prisma.aiModel.delete({ where: { id: BigInt(id) } });
    return this.toModel(deleted);
  }

  private async createClient() {
    return createRuntimePrismaClient<ProviderPrismaClient>();
  }

  private toProvider(row: unknown): ProviderRecord {
    const data = this.readRecord(row, '模型供应商数据库记录格式不正确');
    return {
      providerCode: this.readRequiredString(data.providerCode, '模型供应商记录缺少供应商编码'),
      providerName: this.readRequiredString(data.providerName, '模型供应商记录缺少供应商名称'),
      providerType: readProviderType(data.providerType),
      baseUrl: this.readRequiredString(data.baseUrl, '模型供应商记录缺少接口地址'),
      apiKey: this.readString(data.apiKey, '模型供应商记录缺少 API Key'),
      enabled: this.readBoolean(data.enabled, '模型供应商记录缺少启停状态'),
    };
  }

  private toModel(row: unknown): ModelRecord {
    const data = this.readRecord(row, '模型数据库记录格式不正确');
    const modelType = readModelType(data.modelType);
    const protocol = readModelProtocol(data.protocol);
    return {
      id: this.readRequiredBigIntId(data.id, '模型记录缺少数据库 ID'),
      modelName: this.readRequiredString(data.modelName, '模型记录缺少模型名称'),
      providerCode: this.readRequiredString(data.providerCode, '模型记录缺少供应商编码'),
      modelId: this.readRequiredString(data.modelId, '模型记录缺少模型 ID'),
      modelType,
      protocol,
      parameters: this.readRequiredJsonObject<ModelParameters>(data.parameters, '模型记录缺少参数配置', '模型记录 parameters 不是 JSON 对象'),
      capabilities: this.readRequiredJsonObject<ModelCapabilities>(data.capabilities, '模型记录缺少能力配置', '模型记录 capabilities 不是 JSON 对象'),
      limits: this.readRequiredJsonObject<ModelLimits>(data.limits, '模型记录缺少限制配置', '模型记录 limits 不是 JSON 对象'),
      enabled: this.readBoolean(data.enabled, '模型记录缺少启停状态'),
    };
  }

  private toModelWriteData(record: ModelRecord) {
    return {
      modelName: record.modelName,
      providerCode: record.providerCode,
      modelId: record.modelId,
      modelType: record.modelType,
      protocol: record.protocol,
      parameters: record.parameters,
      capabilities: record.capabilities,
      limits: record.limits,
      enabled: record.enabled,
    };
  }

  private readRecord(value: unknown, message: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    throw new Error(message);
  }

  private readRequiredBigIntId(value: unknown, message: string): string {
    if (typeof value === 'bigint' && value > 0n) return String(value);
    throw new Error(message);
  }

  private readRequiredString(value: unknown, message: string): string {
    if (typeof value === 'string' && value.trim()) return value;
    throw new Error(message);
  }

  private readString(value: unknown, message: string): string {
    if (typeof value === 'string') return value;
    throw new Error(message);
  }

  private readBoolean(value: unknown, message: string): boolean {
    if (typeof value === 'boolean') return value;
    throw new Error(message);
  }

  private readRequiredJsonObject<TRecord extends object>(value: unknown, missingMessage: string, malformedMessage: string): TRecord {
    if (value === null || value === undefined) throw new Error(missingMessage);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as TRecord;
    throw new Error(malformedMessage);
  }

}

export class ProviderService {
  private readonly aiInvocationClient: AiInvocationClient;

  constructor(
    fetchImpl: typeof fetch = fetch,
    private readonly database: ProviderDataStore = new ProviderDatabase(),
  ) {
    this.aiInvocationClient = new AiInvocationClient({ fetchImpl });
  }

  static resolveProtocol(providerType: ProviderType, modelType: ModelType): ModelProtocol {
    if (providerType === 'QWEN') {
      return modelType === 'EMBEDDING' ? 'DASHSCOPE_COMPATIBLE_EMBEDDINGS' : 'DASHSCOPE_COMPATIBLE_CHAT';
    }
    if (providerType === 'DEEPSEEK') return 'DEEPSEEK_CHAT_COMPLETIONS';
    return modelType === 'EMBEDDING' ? 'OPENAI_EMBEDDINGS' : 'OPENAI_CHAT_COMPLETIONS';
  }

  supportedTypes(): ProviderType[] {
    return ['OPENAI_COMPATIBLE', 'QWEN', 'DEEPSEEK'];
  }

  /**
   * @author codex
   * Lists model providers with platform pagination.
   */
  async list(page: { currentPage: number; linesPerPage: number }): Promise<PageResult<ProviderPublicRecord>> {
    const all = await this.getProviderSource();
    const start = (page.currentPage - 1) * page.linesPerPage;
    return pageResult(
      all.slice(start, start + page.linesPerPage).map((provider) => this.toPublicProvider(provider)),
      page.currentPage,
      page.linesPerPage,
      all.length,
    );
  }

  async create(request: ProviderCreateRequest): Promise<ProviderPublicRecord> {
    const providerCode = request.providerCode?.trim() || (await this.createProviderCode(request.providerName, request.providerType));
    if (await this.findProvider(providerCode)) throw new Error('供应商已存在');
    if (!this.supportedTypes().includes(request.providerType)) throw new Error('不支持的模型供应商类型');
    const saved = await this.database.createProvider({
      providerCode,
      providerName: request.providerName.trim(),
      providerType: request.providerType,
      baseUrl: request.baseUrl.trim(),
      apiKey: request.apiKey.trim(),
      enabled: request.enabled ?? true,
    });
    return this.toPublicProvider(saved);
  }

  async update(providerCode: string, request: ProviderUpdateRequest): Promise<ProviderPublicRecord> {
    const provider = await this.getProvider(providerCode);
    if (request.providerType && !this.supportedTypes().includes(request.providerType)) throw new Error('不支持的模型供应商类型');
    const nextApiKey = typeof request.apiKey === 'string' && request.apiKey.trim()
      ? request.apiKey.trim()
      : provider.apiKey;
    const saved = await this.database.updateProvider({
      providerCode,
      providerName: request.providerName?.trim() ?? provider.providerName,
      providerType: request.providerType ?? provider.providerType,
      baseUrl: request.baseUrl?.trim() ?? provider.baseUrl,
      apiKey: nextApiKey,
      enabled: request.enabled ?? provider.enabled,
    });
    return this.toPublicProvider(saved);
  }

  async changeStatus(providerCode: string, enabled: boolean): Promise<ProviderPublicRecord> {
    return this.update(providerCode, { enabled });
  }

  async delete(providerCode: string): Promise<ProviderPublicRecord> {
    const provider = await this.getProvider(providerCode);
    const models = await this.getModelSource();
    if (models.some((model) => model.providerCode === providerCode)) throw new Error('该供应商下仍有关联模型，请先迁移或删除模型');
    const deleted = await this.database.deleteProvider(providerCode);
    return this.toPublicProvider(deleted);
  }

  async testConnection(providerCode: string) {
    const provider = await this.getProvider(providerCode);
    if (!provider.enabled) {
      return { providerCode, status: 'DISABLED', message: '供应商已停用' };
    }
    const result = await this.testConfig({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
    });
    return { ...result, providerCode };
  }

  async testConfig(request: ProviderConfigTestRequest) {
    if (!this.supportedTypes().includes(request.providerType)) throw new Error('不支持的模型供应商类型');
    const baseUrl = request.baseUrl.trim();
    const apiKey = request.apiKey.trim();
    if (!baseUrl || !apiKey) throw new Error('请先填写接口地址和 API Key');
    this.validateProviderBaseUrl(baseUrl);
    try {
      const result = await this.aiInvocationClient.listModels({
        connection: { baseUrl, apiKey },
        request: {
          traceId: `provider-test:${Date.now()}`,
          providerCode: 'transient-provider',
          timeoutMs: 8000,
        },
      });
      if (result.status === 'SUCCEEDED') {
        return { status: 'SUCCESS', message: '连接测试通过，AI 调用服务已完成供应商探测。' };
      }
      return {
        status: 'FAILED',
        message: `连接测试失败：${result.errorMessage ?? result.errorCode ?? '供应商不可访问'}`,
      };
    } catch (error) {
      return {
        status: 'FAILED',
        message: `连接测试失败：${error instanceof Error ? error.message : '供应商不可访问'}`,
      };
    }
  }

  async testModelConnection(id: string) {
    const model = await this.getModel(id);
    const provider = await this.getProvider(model.providerCode);
    if (!provider.enabled || !model.enabled) {
      return {
        id,
        providerCode: provider.providerCode,
        modelId: model.modelId,
        status: 'DISABLED',
        message: '模型或供应商已停用',
      };
    }
    return this.testModelConfig(provider, model);
  }

  /**
   * @author codex
   * Tests a model form payload before it is persisted, so users can verify provider/model ids during creation.
   */
  async testModelConfigPayload(request: ModelConfigTestRequest) {
    const provider = await this.getProvider(request.providerCode);
    if (!provider.enabled) {
      return {
        providerCode: provider.providerCode,
        modelId: request.modelId,
        status: 'DISABLED',
        message: '供应商已停用',
      };
    }
    const modelType = this.normalizeModelType(request.modelType);
    this.assertProviderSupportsModelType(provider.providerType, modelType);
    const model = this.normalizeModelRecord(provider, {
      id: 'transient-model-config',
      modelName: request.modelName,
      providerCode: provider.providerCode,
      modelId: request.modelId,
      modelType,
      protocol: request.protocol ?? ProviderService.resolveProtocol(provider.providerType, modelType),
      parameters: this.readRequiredRequestObject<ModelParameters>(request.parameters, '模型参数配置不能为空'),
      capabilities: this.readRequiredRequestObject<ModelCapabilities>(request.capabilities, '模型能力配置不能为空'),
      limits: this.readRequiredRequestObject<ModelLimits>(request.limits, '模型限制配置不能为空'),
      enabled: true,
    });
    return this.testModelConfig(provider, model);
  }

  /**
   * @author codex
   * Lists concrete model assets under provider sources.
   */
  async modelList(query: ModelQuery, page: { currentPage: number; linesPerPage: number }): Promise<PageResult<ModelRecord>> {
    const keyword = query.keyword?.trim().toLowerCase();
    const all = (await this.getModelSource()).filter((model) => {
      const providerMatched = !query.providerCode || model.providerCode === query.providerCode;
      const typeMatched = !query.modelType || model.modelType === query.modelType;
      const keywordMatched =
        !keyword ||
        [model.modelName, model.modelId, model.providerCode, model.protocol, model.modelType].join(' ').toLowerCase().includes(keyword);
      return providerMatched && typeMatched && keywordMatched;
    });
    const start = (page.currentPage - 1) * page.linesPerPage;
    return pageResult(all.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, all.length);
  }

  async createModel(request: ModelCreateRequest): Promise<ModelRecord> {
    const provider = await this.getProvider(request.providerCode);
    const modelType = this.normalizeModelType(request.modelType);
    this.assertProviderSupportsModelType(provider.providerType, modelType);
    const normalized = this.normalizeModelRecord(provider, {
      id: 'pending-model',
      modelName: request.modelName,
      providerCode: provider.providerCode,
      modelId: request.modelId,
      modelType,
      protocol: request.protocol ?? ProviderService.resolveProtocol(provider.providerType, modelType),
      parameters: this.readRequiredRequestObject<ModelParameters>(request.parameters, '模型参数配置不能为空'),
      capabilities: this.readRequiredRequestObject<ModelCapabilities>(request.capabilities, '模型能力配置不能为空'),
      limits: this.readRequiredRequestObject<ModelLimits>(request.limits, '模型限制配置不能为空'),
      enabled: true,
    });
    return this.database.createModel(normalized);
  }

  async updateModel(id: string, request: ModelUpdateRequest): Promise<ModelRecord> {
    const model = await this.getModel(id);
    const provider = await this.getProvider(request.providerCode ?? model.providerCode);
    const nextType = this.normalizeModelType(request.modelType ?? model.modelType);
    this.assertProviderSupportsModelType(provider.providerType, nextType);
    return this.database.updateModel(
      this.normalizeModelRecord(provider, {
        id,
        modelName: request.modelName ?? model.modelName,
        providerCode: provider.providerCode,
        modelId: request.modelId ?? model.modelId,
        modelType: nextType,
        protocol: request.protocol ?? ProviderService.resolveProtocol(provider.providerType, nextType),
        parameters: request.parameters ?? model.parameters,
        capabilities: request.capabilities ?? model.capabilities,
        limits: request.limits ?? model.limits,
        enabled: request.enabled ?? model.enabled,
      }),
    );
  }

  async changeModelStatus(id: string, enabled: boolean): Promise<ModelRecord> {
    return this.updateModel(id, { enabled });
  }

  async deleteModel(id: string): Promise<ModelRecord> {
    await this.getModel(id);
    const deleted = await this.database.deleteModel(id);
    return deleted;
  }

  private async testModelConfig(provider: ProviderRecord, model: ModelRecord) {
    return model.modelType === 'EMBEDDING'
      ? this.testEmbeddingModelConfig(provider, model)
      : this.testChatModelConfig(provider, model);
  }

  private async testChatModelConfig(provider: ProviderRecord, model: ModelRecord) {
    try {
      const result = await this.aiInvocationClient.invokeChat({
        connection: {
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        },
        request: {
          traceId: `model-test:${model.id}:${Date.now()}`,
          providerCode: provider.providerCode,
          providerKind: this.toInvocationProviderKind(provider),
          modelId: model.modelId,
          protocol: this.toInvocationProtocol(provider, model),
          messages: [{ role: 'user', content: 'ping' }],
          maxTokens: Math.min(model.parameters.maxOutputTokens ?? 16, 64),
          stream: false,
          temperature: typeof model.parameters.temperature === 'number' ? model.parameters.temperature : undefined,
          topP: typeof model.parameters.topP === 'number' ? model.parameters.topP : undefined,
          enableThinking: this.resolveInvocationThinking(provider, model),
          reasoningEffort: this.readInvocationReasoningEffort(model.parameters.reasoningEffort),
          timeoutMs: model.parameters.timeoutMs,
        },
      });
      if (result.status === 'SUCCEEDED') {
        return {
          id: model.id,
          providerCode: provider.providerCode,
          modelId: model.modelId,
          status: 'SUCCESS',
          message: '模型测试调用成功。',
        };
      }
      return {
        id: model.id,
        providerCode: provider.providerCode,
        modelId: model.modelId,
        status: 'FAILED',
        message: `模型测试失败：${result.errorMessage ?? result.errorCode ?? '供应商未返回有效内容'}`,
      };
    } catch (error) {
      return {
        id: model.id,
        providerCode: provider.providerCode,
        modelId: model.modelId,
        status: 'FAILED',
        message: `模型测试失败：${error instanceof Error ? error.message : '模型不可访问'}`,
      };
    }
  }

  private async testEmbeddingModelConfig(provider: ProviderRecord, model: ModelRecord) {
    try {
      const result = await this.aiInvocationClient.invokeEmbedding({
        connection: {
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        },
        request: {
          traceId: `model-test:${model.id}:${Date.now()}`,
          providerCode: provider.providerCode,
          modelId: model.modelId,
          protocol: model.protocol === 'DASHSCOPE_COMPATIBLE_EMBEDDINGS' ? 'DASHSCOPE_COMPATIBLE_EMBEDDINGS' : 'OPENAI_EMBEDDINGS',
          input: 'ping',
          dimensions: model.parameters.dimensions,
          encodingFormat: model.parameters.encodingFormat,
        },
      });
      if (result.status === 'SUCCEEDED') {
        return {
          id: model.id,
          providerCode: provider.providerCode,
          modelId: model.modelId,
          status: 'SUCCESS',
          message: '模型测试调用成功。',
        };
      }
      return {
        id: model.id,
        providerCode: provider.providerCode,
        modelId: model.modelId,
        status: 'FAILED',
        message: `模型测试失败：${result.errorMessage ?? result.errorCode ?? '供应商未返回有效内容'}`,
      };
    } catch (error) {
      return {
        id: model.id,
        providerCode: provider.providerCode,
        modelId: model.modelId,
        status: 'FAILED',
        message: `模型测试失败：${error instanceof Error ? error.message : '模型不可访问'}`,
      };
    }
  }

  private toInvocationProtocol(provider: ProviderRecord, model: ModelRecord): InvocationModelProtocol {
    if (model.protocol === 'DASHSCOPE_COMPATIBLE_CHAT') return 'DASHSCOPE_COMPATIBLE_CHAT';
    if (provider.providerType === 'QWEN') return 'QWEN_COMPATIBLE';
    return 'OPENAI_COMPATIBLE';
  }

  private toInvocationProviderKind(provider: ProviderRecord): ProviderInvocationKind {
    return provider.providerType;
  }

  private resolveInvocationThinking(provider: ProviderRecord, model: ModelRecord): boolean | undefined {
    if ((provider.providerType === 'QWEN' || provider.providerType === 'DEEPSEEK') && model.parameters.thinkingEnabled !== undefined) {
      return model.parameters.thinkingEnabled;
    }
    return undefined;
  }

  /**
   * @author codex
   * Prevents raw provider reasoning payloads from leaking through model parameter JSON.
   */
  private readInvocationReasoningEffort(value: unknown): ModelParameters['reasoningEffort'] {
    if (value === 'low' || value === 'medium' || value === 'high' || value === 'max') return value;
    return undefined;
  }

  private async getProviderSource() {
    return this.database.listProviders();
  }

  private async getModelSource() {
    return this.database.listModels();
  }

  private async findProvider(providerCode: string): Promise<ProviderRecord | null> {
    return this.database.findProvider(providerCode);
  }

  private async findModel(id: string): Promise<ModelRecord | null> {
    return this.database.findModel(id);
  }

  private async getProvider(providerCode: string) {
    const provider = await this.findProvider(providerCode);
    if (!provider) throw new BadRequestException('供应商不存在');
    return provider;
  }

  private async getModel(id: string) {
    const model = await this.findModel(id);
    if (!model) throw new BadRequestException('模型不存在');
    return model;
  }

  private toPublicProvider(provider: ProviderRecord): ProviderPublicRecord {
    return {
      providerCode: provider.providerCode,
      providerName: provider.providerName,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: '',
      apiKeyConfigured: Boolean(provider.apiKey),
      enabled: provider.enabled,
    };
  }

  private readRequiredRequestObject<TRecord extends object>(value: unknown, message: string): TRecord {
    if (value === null || value === undefined) throw new BadRequestException(message);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as TRecord;
    throw new BadRequestException(message);
  }

  private normalizeModelRecord(provider: ProviderRecord, record: ModelRecord): ModelRecord {
    const modelType = this.normalizeModelType(record.modelType);
    const protocol = record.protocol || ProviderService.resolveProtocol(provider.providerType, modelType);
    return {
      id: record.id,
      modelName: record.modelName.trim(),
      providerCode: record.providerCode,
      modelId: record.modelId.trim(),
      modelType,
      protocol,
      parameters: this.normalizeParameters(provider.providerType, modelType, record.parameters),
      capabilities: this.normalizeCapabilities(modelType, record.capabilities),
      limits: this.normalizeLimits(modelType, record.limits),
      enabled: record.enabled,
    };
  }

  private normalizeParameters(providerType: ProviderType, modelType: ModelType, input: ModelParameters): ModelParameters {
    if (modelType === 'EMBEDDING') {
      return {
        dimensions: this.optionalNumber(input.dimensions),
        batchSize: this.optionalNumber(input.batchSize),
        encodingFormat: input.encodingFormat === 'base64' ? 'base64' : 'float',
        timeoutMs: this.optionalNumber(input.timeoutMs),
      };
    }
    return {
      temperature: this.optionalNumber(input.temperature),
      topP: this.optionalNumber(input.topP),
      topK: providerType === 'QWEN' ? this.optionalNumber(input.topK) : undefined,
      maxOutputTokens: this.optionalNumber(input.maxOutputTokens),
      stream: input.stream,
      jsonMode: input.jsonMode,
      toolCalling: input.toolCalling,
      thinkingEnabled: input.thinkingEnabled,
      reasoningEffort: input.reasoningEffort,
      timeoutMs: this.optionalNumber(input.timeoutMs),
    };
  }

  private normalizeCapabilities(modelType: ModelType, input: ModelCapabilities): ModelCapabilities {
    if (modelType === 'EMBEDDING') {
      return { embedding: true };
    }
    return {
      stream: input.stream,
      jsonMode: input.jsonMode,
      toolCalling: input.toolCalling,
      reasoning: input.reasoning,
    };
  }

  private normalizeLimits(modelType: ModelType, input: ModelLimits): ModelLimits {
    if (modelType === 'EMBEDDING') {
      return {
        maxInputTokens: this.optionalNumber(input.maxInputTokens),
        embeddingDimensions: this.optionalNumber(input.embeddingDimensions),
        pricing: this.normalizePricing(input.pricing),
      };
    }
    return {
      contextWindow: this.optionalNumber(input.contextWindow),
      maxOutputTokens: this.optionalNumber(input.maxOutputTokens),
      pricing: this.normalizePricing(input.pricing),
    };
  }

  private normalizePricing(input: unknown): ModelPricing | undefined {
    const pricing = this.asRecord(input);
    if (Object.keys(pricing).length === 0) return undefined;
    return {
      currency: 'CNY',
      unit: 'PER_MILLION_TOKENS',
      normalInputPrice: this.optionalPrice(pricing.normalInputPrice),
      cachedInputPrice: this.optionalPrice(pricing.cachedInputPrice),
      outputPrice: this.optionalPrice(pricing.outputPrice),
      cacheWriteInputPrice: this.optionalPrice(pricing.cacheWriteInputPrice),
    };
  }

  private normalizeModelType(value: unknown): ModelType {
    return readModelType(value);
  }

  private assertProviderSupportsModelType(providerType: ProviderType, modelType: ModelType) {
    if (providerType === 'DEEPSEEK' && modelType === 'EMBEDDING') {
      throw new Error('DeepSeek 官方供应商暂不支持在平台内配置 Embedding 模型');
    }
  }

  private optionalNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && value !== '' && value !== null ? parsed : undefined;
  }

  private optionalPrice(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < 0) throw new BadRequestException('模型价格不能为负数');
    return parsed;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  /**
   * @author codex
   * Keeps platform validation to provider URL shape; AI invocation owns provider wire paths.
   */
  private validateProviderBaseUrl(baseUrl: string) {
    try {
      new URL(baseUrl);
    } catch {
      throw new Error('接口地址格式不正确');
    }
  }

  /**
   * @author codex
   * Generates an internal provider key so users do not need to maintain provider codes in the UI.
   */
  private async createProviderCode(providerName: string, providerType: ProviderType) {
    const nameSlug = providerName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const typeSlug = providerType.toLowerCase().replace(/_/g, '-');
    const baseCode = `provider-${nameSlug || typeSlug}`;
    let nextCode = baseCode;
    let index = 2;
    while (await this.findProvider(nextCode)) {
      nextCode = `${baseCode}-${index}`;
      index += 1;
    }
    return nextCode;
  }
}
