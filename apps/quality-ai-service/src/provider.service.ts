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

export interface ProviderRecord {
  providerCode: string;
  providerName: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
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
  parameters?: ModelParameters;
  capabilities?: ModelCapabilities;
  limits?: ModelLimits;
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

class ProviderDatabase {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Reads provider and model configuration from MySQL; no provider or model is created implicitly.
   */
  async listProviders(): Promise<ProviderRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = await prisma.aiProvider.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toProvider(row));
  }

  async listModels(): Promise<ModelRecord[] | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const rows = await prisma.aiModel.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => this.toModel(row));
  }

  async findProvider(providerCode: string): Promise<ProviderRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.aiProvider.findUnique({ where: { providerCode } });
    return row ? this.toProvider(row) : null;
  }

  async findModel(id: string): Promise<ModelRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.aiModel.findUnique({ where: { id: BigInt(id) } });
    return row ? this.toModel(row) : null;
  }

  async createProvider(record: ProviderRecord): Promise<ProviderRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.aiProvider.create({ data: record });
    return this.toProvider(saved);
  }

  async updateProvider(record: ProviderRecord): Promise<ProviderRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.aiProvider.update({
      where: { providerCode: record.providerCode },
      data: record,
    });
    return this.toProvider(saved);
  }

  async deleteProvider(providerCode: string): Promise<ProviderRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const deleted = await prisma.aiProvider.delete({ where: { providerCode } });
    return this.toProvider(deleted);
  }

  async createModel(record: ModelRecord): Promise<ModelRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.aiModel.create({ data: this.toModelWriteData(record) });
    return this.toModel(saved);
  }

  async updateModel(record: ModelRecord): Promise<ModelRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.aiModel.update({
      where: { id: BigInt(record.id) },
      data: this.toModelWriteData(record),
    });
    return this.toModel(saved);
  }

  async deleteModel(id: string): Promise<ModelRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const deleted = await prisma.aiModel.delete({ where: { id: BigInt(id) } });
    return this.toModel(deleted);
  }

  private async createClient() {
    if (process.env.VITEST) return null;
    return createRuntimePrismaClient<ProviderPrismaClient>();
  }

  private toProvider(row: unknown): ProviderRecord {
    const data = this.asRecord(row);
    return {
      providerCode: String(data.providerCode),
      providerName: String(data.providerName),
      providerType: this.normalizeProviderType(data.providerType),
      baseUrl: String(data.baseUrl ?? ''),
      apiKey: String(data.apiKey ?? ''),
      enabled: data.enabled !== false,
    };
  }

  private toModel(row: unknown): ModelRecord {
    const data = this.asRecord(row);
    const providerType = this.normalizeProviderType(data.providerType);
    const modelType = this.normalizeModelType(data.modelType);
    const protocol = this.normalizeProtocol(data.protocol, providerType, modelType);
    return {
      id: String(data.id),
      modelName: String(data.modelName),
      providerCode: String(data.providerCode),
      modelId: String(data.modelId ?? ''),
      modelType,
      protocol,
      parameters: this.readJsonObject(data.parametersJson),
      capabilities: this.readJsonObject(data.capabilitiesJson),
      limits: this.readJsonObject(data.limitsJson),
      enabled: data.enabled !== false,
    };
  }

  private toModelWriteData(record: ModelRecord) {
    return {
      modelName: record.modelName,
      providerCode: record.providerCode,
      modelId: record.modelId,
      modelType: record.modelType,
      protocol: record.protocol,
      parametersJson: record.parameters,
      capabilitiesJson: record.capabilities,
      limitsJson: record.limits,
      enabled: record.enabled,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private readJsonObject(value: unknown): Record<string, unknown> {
    return this.asRecord(value);
  }

  private normalizeProviderType(value: unknown): ProviderType {
    return value === 'QWEN' || value === 'DEEPSEEK' ? value : 'OPENAI_COMPATIBLE';
  }

  private normalizeModelType(value: unknown): ModelType {
    return value === 'EMBEDDING' ? 'EMBEDDING' : 'LLM';
  }

  private normalizeProtocol(value: unknown, providerType: ProviderType, modelType: ModelType): ModelProtocol {
    if (
      value === 'OPENAI_CHAT_COMPLETIONS' ||
      value === 'OPENAI_EMBEDDINGS' ||
      value === 'DASHSCOPE_COMPATIBLE_CHAT' ||
      value === 'DASHSCOPE_COMPATIBLE_EMBEDDINGS' ||
      value === 'DEEPSEEK_CHAT_COMPLETIONS'
    ) {
      return value;
    }
    return ProviderService.resolveProtocol(providerType, modelType);
  }
}

export class ProviderService {
  private readonly database = new ProviderDatabase();
  private readonly providers = new Map<string, ProviderRecord>();
  private readonly models = new Map<string, ModelRecord>();
  private nextMemoryModelId = 1;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

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
  async list(page: { currentPage: number; linesPerPage: number }): Promise<PageResult<ProviderRecord>> {
    const all = await this.getProviderSource();
    const start = (page.currentPage - 1) * page.linesPerPage;
    return pageResult(all.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, all.length);
  }

  async create(request: ProviderCreateRequest): Promise<ProviderRecord> {
    const providerCode = request.providerCode?.trim() || (await this.createProviderCode(request.providerName, request.providerType));
    if (await this.findProvider(providerCode)) throw new Error('供应商已存在');
    if (!this.supportedTypes().includes(request.providerType)) throw new Error('不支持的模型供应商类型');
    return this.persistProvider({
      providerCode,
      providerName: request.providerName.trim(),
      providerType: request.providerType,
      baseUrl: request.baseUrl.trim(),
      apiKey: request.apiKey.trim(),
      enabled: request.enabled ?? true,
    });
  }

  async update(providerCode: string, request: ProviderUpdateRequest): Promise<ProviderRecord> {
    const provider = await this.getProvider(providerCode);
    if (request.providerType && !this.supportedTypes().includes(request.providerType)) throw new Error('不支持的模型供应商类型');
    return this.persistProvider({
      ...provider,
      ...request,
      providerCode,
      providerName: request.providerName?.trim() ?? provider.providerName,
      baseUrl: request.baseUrl?.trim() ?? provider.baseUrl,
      apiKey: request.apiKey?.trim() ?? provider.apiKey,
    });
  }

  async changeStatus(providerCode: string, enabled: boolean): Promise<ProviderRecord> {
    return this.update(providerCode, { enabled });
  }

  async delete(providerCode: string): Promise<ProviderRecord> {
    const provider = await this.getProvider(providerCode);
    const models = await this.getModelSource();
    if (models.some((model) => model.providerCode === providerCode)) throw new Error('该供应商下仍有关联模型，请先迁移或删除模型');
    const deleted = await this.database.deleteProvider(providerCode);
    this.providers.delete(providerCode);
    return deleted ?? provider;
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
    const endpoint = this.buildEndpoint(baseUrl, 'models');
    try {
      const response = await this.fetchWithTimeout(endpoint, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (response.ok) {
        return { endpoint, status: 'SUCCESS', message: '连接测试通过，供应商端点可访问。' };
      }
      return {
        endpoint,
        status: 'FAILED',
        message: `连接测试失败：供应商返回 HTTP ${response.status}${await this.readResponseSummary(response)}`,
      };
    } catch (error) {
      return {
        endpoint,
        status: 'FAILED',
        message: `连接测试失败：${error instanceof Error ? error.message : '供应商端点不可访问'}`,
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
      parameters: request.parameters ?? {},
      capabilities: request.capabilities ?? {},
      limits: request.limits ?? {},
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
      id: this.createMemoryModelId(),
      modelName: request.modelName,
      providerCode: provider.providerCode,
      modelId: request.modelId,
      modelType,
      protocol: request.protocol ?? ProviderService.resolveProtocol(provider.providerType, modelType),
      parameters: request.parameters ?? {},
      capabilities: request.capabilities ?? {},
      limits: request.limits ?? {},
      enabled: true,
    });
    return this.persistModel(normalized);
  }

  async updateModel(id: string, request: ModelUpdateRequest): Promise<ModelRecord> {
    const model = await this.getModel(id);
    const provider = await this.getProvider(request.providerCode ?? model.providerCode);
    const nextType = this.normalizeModelType(request.modelType ?? model.modelType);
    this.assertProviderSupportsModelType(provider.providerType, nextType);
    return this.persistModel(
      this.normalizeModelRecord(provider, {
        ...model,
        ...request,
        id,
        providerCode: provider.providerCode,
        modelType: nextType,
        protocol: request.protocol ?? ProviderService.resolveProtocol(provider.providerType, nextType),
      }),
    );
  }

  async changeModelStatus(id: string, enabled: boolean): Promise<ModelRecord> {
    return this.updateModel(id, { enabled });
  }

  async deleteModel(id: string): Promise<ModelRecord> {
    const model = await this.getModel(id);
    const deleted = await this.database.deleteModel(id);
    this.models.delete(id);
    return deleted ?? model;
  }

  private async testModelConfig(provider: ProviderRecord, model: ModelRecord) {
    const path = model.modelType === 'EMBEDDING' ? 'embeddings' : 'chat/completions';
    const endpoint = this.buildEndpoint(provider.baseUrl, path);
    try {
      const response = await this.fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(model.modelType === 'EMBEDDING' ? this.buildEmbeddingTestBody(model) : this.buildChatTestBody(model)),
      });
      if (response.ok) {
        return {
          endpoint,
          id: model.id,
          providerCode: provider.providerCode,
          modelId: model.modelId,
          status: 'SUCCESS',
          message: '模型测试调用成功。',
        };
      }
      return {
        endpoint,
        id: model.id,
        providerCode: provider.providerCode,
        modelId: model.modelId,
        status: 'FAILED',
        message: `模型测试失败：供应商返回 HTTP ${response.status}${await this.readResponseSummary(response)}`,
      };
    } catch (error) {
      return {
        endpoint,
        id: model.id,
        providerCode: provider.providerCode,
        modelId: model.modelId,
        status: 'FAILED',
        message: `模型测试失败：${error instanceof Error ? error.message : '模型端点不可访问'}`,
      };
    }
  }

  private buildChatTestBody(model: ModelRecord) {
    const parameters = model.parameters;
    const body: Record<string, unknown> = {
      model: model.modelId,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: Math.min(parameters.maxOutputTokens ?? 16, 64),
      stream: false,
    };
    if (typeof parameters.temperature === 'number') body.temperature = parameters.temperature;
    if (typeof parameters.topP === 'number') body.top_p = parameters.topP;
    if (model.protocol === 'DEEPSEEK_CHAT_COMPLETIONS' && parameters.thinkingEnabled !== undefined) {
      body.thinking = { type: parameters.thinkingEnabled ? 'enabled' : 'disabled' };
    }
    if (parameters.reasoningEffort) body.reasoning_effort = parameters.reasoningEffort;
    return body;
  }

  private buildEmbeddingTestBody(model: ModelRecord) {
    const parameters = model.parameters;
    const body: Record<string, unknown> = {
      model: model.modelId,
      input: 'ping',
    };
    if (typeof parameters.dimensions === 'number' && parameters.dimensions > 0) body.dimensions = parameters.dimensions;
    if (parameters.encodingFormat) body.encoding_format = parameters.encodingFormat;
    return body;
  }

  private async getProviderSource() {
    const databaseProviders = await this.database.listProviders();
    if (databaseProviders) {
      this.providers.clear();
      databaseProviders.forEach((provider) => this.providers.set(provider.providerCode, provider));
      return databaseProviders;
    }
    return Array.from(this.providers.values());
  }

  private async getModelSource() {
    const databaseModels = await this.database.listModels();
    if (databaseModels) {
      this.models.clear();
      databaseModels.forEach((model) => this.models.set(model.id, model));
      return databaseModels;
    }
    return Array.from(this.models.values());
  }

  private async findProvider(providerCode: string): Promise<ProviderRecord | null> {
    const databaseProvider = await this.database.findProvider(providerCode);
    if (databaseProvider !== undefined) {
      if (databaseProvider) this.providers.set(databaseProvider.providerCode, databaseProvider);
      return databaseProvider;
    }
    return this.providers.get(providerCode) ?? null;
  }

  private async findModel(id: string): Promise<ModelRecord | null> {
    const databaseModel = await this.database.findModel(id);
    if (databaseModel !== undefined) {
      if (databaseModel) this.models.set(databaseModel.id, databaseModel);
      return databaseModel;
    }
    return this.models.get(id) ?? null;
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

  private async persistProvider(record: ProviderRecord) {
    const saved = this.providers.has(record.providerCode)
      ? await this.database.updateProvider(record)
      : await this.database.createProvider(record);
    const next = saved ?? record;
    this.providers.set(next.providerCode, next);
    return next;
  }

  private async persistModel(record: ModelRecord) {
    const saved = this.models.has(record.id) ? await this.database.updateModel(record) : await this.database.createModel(record);
    const next = saved ?? record;
    this.models.set(next.id, next);
    return next;
  }

  private normalizeModelRecord(provider: ProviderRecord, record: ModelRecord): ModelRecord {
    const modelType = this.normalizeModelType(record.modelType);
    const protocol = record.protocol || ProviderService.resolveProtocol(provider.providerType, modelType);
    return {
      ...record,
      modelName: record.modelName.trim(),
      modelId: record.modelId.trim(),
      modelType,
      protocol,
      parameters: this.normalizeParameters(provider.providerType, modelType, record.parameters),
      capabilities: this.normalizeCapabilities(provider.providerType, modelType, record.capabilities),
      limits: this.normalizeLimits(modelType, record.parameters, record.limits),
    };
  }

  private normalizeParameters(providerType: ProviderType, modelType: ModelType, input: ModelParameters): ModelParameters {
    if (modelType === 'EMBEDDING') {
      return {
        dimensions: this.optionalNumber(input.dimensions),
        batchSize: this.optionalNumber(input.batchSize) ?? 16,
        encodingFormat: input.encodingFormat === 'base64' ? 'base64' : 'float',
        timeoutMs: this.optionalNumber(input.timeoutMs) ?? 30000,
      };
    }
    const defaultTemperature = providerType === 'DEEPSEEK' ? 1 : 0.2;
    return {
      temperature: this.optionalNumber(input.temperature) ?? defaultTemperature,
      topP: this.optionalNumber(input.topP) ?? 1,
      topK: providerType === 'QWEN' ? (this.optionalNumber(input.topK) ?? 0) : undefined,
      maxOutputTokens: this.optionalNumber(input.maxOutputTokens) ?? 4096,
      stream: input.stream ?? true,
      jsonMode: input.jsonMode ?? providerType !== 'DEEPSEEK',
      toolCalling: input.toolCalling ?? providerType !== 'DEEPSEEK',
      thinkingEnabled: input.thinkingEnabled ?? (providerType === 'DEEPSEEK' ? true : false),
      reasoningEffort: input.reasoningEffort ?? (providerType === 'DEEPSEEK' ? 'high' : undefined),
      timeoutMs: this.optionalNumber(input.timeoutMs) ?? 60000,
    };
  }

  private normalizeCapabilities(providerType: ProviderType, modelType: ModelType, input: ModelCapabilities): ModelCapabilities {
    if (modelType === 'EMBEDDING') {
      return { embedding: true };
    }
    return {
      stream: input.stream ?? true,
      jsonMode: input.jsonMode ?? providerType !== 'DEEPSEEK',
      toolCalling: input.toolCalling ?? providerType !== 'DEEPSEEK',
      reasoning: input.reasoning ?? providerType === 'DEEPSEEK',
    };
  }

  private normalizeLimits(modelType: ModelType, parameters: ModelParameters, input: ModelLimits): ModelLimits {
    if (modelType === 'EMBEDDING') {
      return {
        maxInputTokens: this.optionalNumber(input.maxInputTokens) ?? 8192,
        embeddingDimensions: this.optionalNumber(input.embeddingDimensions) ?? this.optionalNumber(parameters.dimensions),
        pricing: this.normalizePricing(input.pricing),
      };
    }
    return {
      contextWindow: this.optionalNumber(input.contextWindow) ?? 128000,
      maxOutputTokens: this.optionalNumber(input.maxOutputTokens) ?? this.optionalNumber(parameters.maxOutputTokens) ?? 4096,
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
    return value === 'EMBEDDING' ? 'EMBEDDING' : 'LLM';
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

  private buildEndpoint(baseUrl: string, path: string) {
    try {
      const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
      return new URL(`${normalizedBaseUrl}/${path}`).toString();
    } catch {
      throw new Error('接口地址格式不正确');
    }
  }

  private async fetchWithTimeout(endpoint: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      return await this.fetchImpl(endpoint, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readResponseSummary(response: Response) {
    const body = await response.text().catch(() => '');
    const summary = body.replace(/\s+/g, ' ').trim().slice(0, 120);
    return summary ? `，${summary}` : '';
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

  private createMemoryModelId() {
    const id = String(this.nextMemoryModelId);
    this.nextMemoryModelId += 1;
    return id;
  }
}
