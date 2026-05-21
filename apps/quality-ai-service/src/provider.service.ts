import { createRuntimePrismaClient } from '@ai-quality-platform/shared-database';
import { pageResult, type PageResult } from '@ai-quality-platform/shared-http';

export type ProviderType = 'OPENAI_COMPATIBLE' | 'QWEN' | 'DEEPSEEK';
export type ModelPurpose = 'JUDGE' | 'EXECUTION' | 'EMBEDDING';

export interface ProviderRecord {
  providerCode: string;
  providerName: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  enabled: boolean;
}

export interface ProviderCreateRequest {
  providerCode?: string;
  providerName: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  enabled?: boolean;
}

export interface ProviderConfigTestRequest {
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
}

export type ProviderUpdateRequest = Partial<Omit<ProviderRecord, 'providerCode'>>;

export interface ModelRecord {
  modelCode: string;
  modelName: string;
  providerCode: string;
  modelId: string;
  purpose: ModelPurpose;
  contextWindow: number;
  temperature: number;
  enabled: boolean;
}

export interface ModelCreateRequest {
  modelCode: string;
  modelName: string;
  providerCode: string;
  modelId: string;
  purpose: ModelPurpose;
  contextWindow: number;
  temperature: number;
}

export interface ModelQuery {
  providerCode?: string;
  purpose?: ModelPurpose;
  keyword?: string;
}

export type ModelUpdateRequest = Partial<Omit<ModelRecord, 'modelCode'>>;

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
    findUnique(input: { where: { modelCode: string } }): Promise<unknown | null>;
    create(input: { data: object }): Promise<unknown>;
    update(input: { where: { modelCode: string }; data: object }): Promise<unknown>;
    delete(input: { where: { modelCode: string } }): Promise<unknown>;
  };
};

class ProviderDatabase {
  private readonly prismaPromise = this.createClient();

  /**
   * @author codex
   * Reads provider and model configuration from MySQL; no provider is created implicitly.
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

  async findModel(modelCode: string): Promise<ModelRecord | null | undefined> {
    const prisma = await this.prismaPromise;
    if (!prisma) return undefined;
    const row = await prisma.aiModel.findUnique({ where: { modelCode } });
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
    const saved = await prisma.aiModel.create({ data: record });
    return this.toModel(saved);
  }

  async updateModel(record: ModelRecord): Promise<ModelRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const saved = await prisma.aiModel.update({
      where: { modelCode: record.modelCode },
      data: record,
    });
    return this.toModel(saved);
  }

  async deleteModel(modelCode: string): Promise<ModelRecord | null> {
    const prisma = await this.prismaPromise;
    if (!prisma) return null;
    const deleted = await prisma.aiModel.delete({ where: { modelCode } });
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
      defaultModel: String(data.defaultModel ?? ''),
      enabled: data.enabled !== false,
    };
  }

  private toModel(row: unknown): ModelRecord {
    const data = this.asRecord(row);
    return {
      modelCode: String(data.modelCode),
      modelName: String(data.modelName),
      providerCode: String(data.providerCode),
      modelId: String(data.modelId ?? ''),
      purpose: this.normalizePurpose(data.purpose),
      contextWindow: Number(data.contextWindow ?? 0),
      temperature: Number(data.temperature?.toString?.() ?? data.temperature ?? 0),
      enabled: data.enabled !== false,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private normalizeProviderType(value: unknown): ProviderType {
    return value === 'QWEN' || value === 'DEEPSEEK' ? value : 'OPENAI_COMPATIBLE';
  }

  private normalizePurpose(value: unknown): ModelPurpose {
    return value === 'EXECUTION' || value === 'EMBEDDING' ? value : 'JUDGE';
  }
}

export class ProviderService {
  private readonly database = new ProviderDatabase();
  private readonly providers = new Map<string, ProviderRecord>();
  private readonly models = new Map<string, ModelRecord>();

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

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
    if (await this.findProvider(providerCode)) {
      throw new Error('供应商已存在');
    }
    if (!this.supportedTypes().includes(request.providerType)) {
      throw new Error('不支持的模型供应商类型');
    }
    return this.persistProvider({ ...request, providerCode, enabled: request.enabled ?? true });
  }

  async update(providerCode: string, request: ProviderUpdateRequest): Promise<ProviderRecord> {
    const provider = await this.getProvider(providerCode);
    if (request.providerType && !this.supportedTypes().includes(request.providerType)) {
      throw new Error('不支持的模型供应商类型');
    }
    return this.persistProvider({ ...provider, ...request, providerCode });
  }

  async changeStatus(providerCode: string, enabled: boolean): Promise<ProviderRecord> {
    return this.update(providerCode, { enabled });
  }

  async delete(providerCode: string): Promise<ProviderRecord> {
    const provider = await this.getProvider(providerCode);
    const models = await this.getModelSource();
    if (models.some((model) => model.providerCode === providerCode)) {
      throw new Error('该供应商下仍有关联模型，请先迁移或删除模型');
    }
    const deleted = await this.database.deleteProvider(providerCode);
    this.providers.delete(providerCode);
    return deleted ?? provider;
  }

  async testConnection(providerCode: string) {
    const provider = await this.getProvider(providerCode);
    if (!provider.enabled) {
      return {
        providerCode,
        status: 'DISABLED',
        message: '供应商已停用',
      };
    }
    const result = await this.testConfig({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
    });
    return {
      ...result,
      providerCode,
    };
  }

  async testConfig(request: ProviderConfigTestRequest) {
    if (!this.supportedTypes().includes(request.providerType)) {
      throw new Error('不支持的模型供应商类型');
    }
    const baseUrl = request.baseUrl.trim();
    const apiKey = request.apiKey.trim();
    if (!baseUrl || !apiKey) {
      throw new Error('请先填写接口地址和 API Key');
    }
    const endpoint = this.buildModelsEndpoint(baseUrl);
    try {
      const response = await this.fetchWithTimeout(endpoint, apiKey);
      if (response.ok) {
        return {
          endpoint,
          status: 'SUCCESS',
          message: '连接测试通过，供应商端点可访问。',
        };
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

  async testModelConnection(modelCode: string) {
    const model = await this.getModel(modelCode);
    const provider = await this.getProvider(model.providerCode);
    if (!provider.enabled || !model.enabled) {
      return {
        modelCode,
        providerCode: provider.providerCode,
        modelId: model.modelId,
        status: 'DISABLED',
        message: '模型或供应商已停用',
      };
    }
    const result = await this.testConfig({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
    });
    return {
      ...result,
      modelCode,
      providerCode: provider.providerCode,
      modelId: model.modelId,
    };
  }

  /**
   * @author codex
   * Lists concrete model configurations under provider sources.
   */
  async modelList(query: ModelQuery, page: { currentPage: number; linesPerPage: number }): Promise<PageResult<ModelRecord>> {
    const keyword = query.keyword?.trim();
    const all = (await this.getModelSource()).filter((model) => {
      const providerMatched = !query.providerCode || model.providerCode === query.providerCode;
      const purposeMatched = !query.purpose || model.purpose === query.purpose;
      const keywordMatched = !keyword || model.modelName.includes(keyword) || model.modelCode.includes(keyword) || model.modelId.includes(keyword);
      return providerMatched && purposeMatched && keywordMatched;
    });
    const start = (page.currentPage - 1) * page.linesPerPage;
    return pageResult(all.slice(start, start + page.linesPerPage), page.currentPage, page.linesPerPage, all.length);
  }

  async createModel(request: ModelCreateRequest): Promise<ModelRecord> {
    if (await this.findModel(request.modelCode)) throw new Error('模型编码已存在');
    if (!(await this.findProvider(request.providerCode))) throw new Error('模型供应商不存在');
    return this.persistModel({ ...request, enabled: true });
  }

  async updateModel(modelCode: string, request: ModelUpdateRequest): Promise<ModelRecord> {
    const model = await this.getModel(modelCode);
    if (request.providerCode && !(await this.findProvider(request.providerCode))) throw new Error('模型供应商不存在');
    return this.persistModel({ ...model, ...request, modelCode });
  }

  async changeModelStatus(modelCode: string, enabled: boolean): Promise<ModelRecord> {
    return this.updateModel(modelCode, { enabled });
  }

  async deleteModel(modelCode: string): Promise<ModelRecord> {
    const model = await this.getModel(modelCode);
    const deleted = await this.database.deleteModel(modelCode);
    this.models.delete(modelCode);
    return deleted ?? model;
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
      databaseModels.forEach((model) => this.models.set(model.modelCode, model));
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

  private async findModel(modelCode: string): Promise<ModelRecord | null> {
    const databaseModel = await this.database.findModel(modelCode);
    if (databaseModel !== undefined) {
      if (databaseModel) this.models.set(databaseModel.modelCode, databaseModel);
      return databaseModel;
    }
    return this.models.get(modelCode) ?? null;
  }

  private async getProvider(providerCode: string) {
    const provider = await this.findProvider(providerCode);
    if (!provider) throw new Error('供应商不存在');
    return provider;
  }

  private async getModel(modelCode: string) {
    const model = await this.findModel(modelCode);
    if (!model) throw new Error('模型不存在');
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
    const saved = this.models.has(record.modelCode)
      ? await this.database.updateModel(record)
      : await this.database.createModel(record);
    const next = saved ?? record;
    this.models.set(next.modelCode, next);
    return next;
  }

  private buildModelsEndpoint(baseUrl: string) {
    try {
      const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
      return new URL(`${normalizedBaseUrl}/models`).toString();
    } catch {
      throw new Error('接口地址格式不正确');
    }
  }

  private async fetchWithTimeout(endpoint: string, apiKey: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      return await this.fetchImpl(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
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
}
