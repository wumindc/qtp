/**
 * @author codex
 * Internal HTTP client for the dedicated AI invocation service.
 */
import {
  createFailedEmbeddingInvocationResult,
  createFailedModelDiscoveryResult,
  createFailedModelInvocationResult,
  normalizeModelUsage,
  type EmbeddingInvocationRequest,
  type EmbeddingInvocationResult,
  type ModelDiscoveryRequest,
  type ModelDiscoveryResult,
  type ModelInvocationRequest,
  type ModelInvocationResult,
  type NormalizedModelUsage,
} from '@ai-quality-platform/ai-invocation-contract';
import { CONTEXT_PATH, getLocalServiceUrl } from '@ai-quality-platform/shared-config';

export type {
  EmbeddingInvocationRequest,
  EmbeddingInvocationResult,
  EmbeddingModelProtocol,
  ModelDiscoveryRequest,
  ModelDiscoveryResult,
  ModelInvocationMessage,
  ModelInvocationRequest,
  ModelInvocationResult,
  ModelProtocol,
  NormalizedModelUsage,
  ProviderInvocationKind,
} from '@ai-quality-platform/ai-invocation-contract';

export interface AiInvocationConnection {
  baseUrl: string;
  apiKey: string;
}

export interface RemoteChatInvocationRequest {
  connection: AiInvocationConnection;
  request: ModelInvocationRequest;
}

export interface RemoteEmbeddingInvocationRequest {
  connection: AiInvocationConnection;
  request: EmbeddingInvocationRequest;
}

export interface RemoteModelDiscoveryRequest {
  connection: AiInvocationConnection;
  request: ModelDiscoveryRequest;
}

export interface AiInvocationClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * @author codex
 * Normalizes model usage through the internal invocation client boundary.
 */
export function normalizeInvocationUsage(usage: unknown): NormalizedModelUsage {
  return normalizeModelUsage(usage);
}

/**
 * @author codex
 * Stores the internal model invocation contract in audit records without leaking provider wire payloads.
 */
export function toInvocationAuditJson(request: ModelInvocationRequest): Record<string, unknown> {
  return stripUndefined(request) as Record<string, unknown>;
}

export class AiInvocationClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AiInvocationClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? `${getLocalServiceUrl('aiInvocation')}/${CONTEXT_PATH}`;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async invokeChat(payload: RemoteChatInvocationRequest): Promise<ModelInvocationResult> {
    const startedAt = Date.now();
    try {
      const response = await this.post('/model/chat/invoke.do', payload);
      if (!response.ok) {
        return createFailedModelInvocationResult(
          'AI_INVOCATION_SERVICE_HTTP_ERROR',
          `AI 调用服务返回 HTTP ${response.status}`,
          Date.now() - startedAt,
        );
      }
      const data = await this.readResponseData(response);
      if (!this.hasInvocationResultStatus(data)) {
        return createFailedModelInvocationResult(
          'AI_INVOCATION_SERVICE_BAD_RESPONSE',
          'AI 调用服务返回了非法结果结构',
          Date.now() - startedAt,
        );
      }
      return data as unknown as ModelInvocationResult;
    } catch (error) {
      if (isBadResponseError(error)) {
        return createFailedModelInvocationResult(
          'AI_INVOCATION_SERVICE_BAD_RESPONSE',
          error.message,
          Date.now() - startedAt,
        );
      }
      if (isAbortError(error)) {
        return createFailedModelInvocationResult(
          'PROVIDER_TIMEOUT',
          '模型供应商调用超时',
          Date.now() - startedAt,
        );
      }
      return createFailedModelInvocationResult(
        'AI_INVOCATION_SERVICE_UNREACHABLE',
        error instanceof Error ? error.message : 'AI 调用服务不可用',
        Date.now() - startedAt,
      );
    }
  }

  async invokeEmbedding(payload: RemoteEmbeddingInvocationRequest): Promise<EmbeddingInvocationResult> {
    const startedAt = Date.now();
    try {
      const response = await this.post('/model/embedding/invoke.do', payload);
      if (!response.ok) {
        return createFailedEmbeddingInvocationResult(
          'AI_INVOCATION_SERVICE_HTTP_ERROR',
          `AI 调用服务返回 HTTP ${response.status}`,
          Date.now() - startedAt,
        );
      }
      const data = await this.readResponseData(response);
      if (!this.hasInvocationResultStatus(data)) {
        return createFailedEmbeddingInvocationResult(
          'AI_INVOCATION_SERVICE_BAD_RESPONSE',
          'AI 调用服务返回了非法结果结构',
          Date.now() - startedAt,
        );
      }
      return data as unknown as EmbeddingInvocationResult;
    } catch (error) {
      if (isBadResponseError(error)) {
        return createFailedEmbeddingInvocationResult(
          'AI_INVOCATION_SERVICE_BAD_RESPONSE',
          error.message,
          Date.now() - startedAt,
        );
      }
      if (isAbortError(error)) {
        return createFailedEmbeddingInvocationResult(
          'PROVIDER_TIMEOUT',
          '模型供应商调用超时',
          Date.now() - startedAt,
        );
      }
      return createFailedEmbeddingInvocationResult(
        'AI_INVOCATION_SERVICE_UNREACHABLE',
        error instanceof Error ? error.message : 'AI 调用服务不可用',
        Date.now() - startedAt,
      );
    }
  }

  async listModels(payload: RemoteModelDiscoveryRequest): Promise<ModelDiscoveryResult> {
    const startedAt = Date.now();
    try {
      const response = await this.post('/model/models/list.do', payload);
      if (!response.ok) {
        return createFailedModelDiscoveryResult(
          'AI_INVOCATION_SERVICE_HTTP_ERROR',
          `AI 调用服务返回 HTTP ${response.status}`,
          Date.now() - startedAt,
        );
      }
      const data = await this.readResponseData(response);
      if (!this.hasInvocationResultStatus(data)) {
        return createFailedModelDiscoveryResult(
          'AI_INVOCATION_SERVICE_BAD_RESPONSE',
          'AI 调用服务返回了非法结果结构',
          Date.now() - startedAt,
        );
      }
      return data as unknown as ModelDiscoveryResult;
    } catch (error) {
      if (isBadResponseError(error)) {
        return createFailedModelDiscoveryResult(
          'AI_INVOCATION_SERVICE_BAD_RESPONSE',
          error.message,
          Date.now() - startedAt,
        );
      }
      if (isAbortError(error)) {
        return createFailedModelDiscoveryResult(
          'PROVIDER_TIMEOUT',
          '模型供应商调用超时',
          Date.now() - startedAt,
        );
      }
      return createFailedModelDiscoveryResult(
        'AI_INVOCATION_SERVICE_UNREACHABLE',
        error instanceof Error ? error.message : 'AI 调用服务不可用',
        Date.now() - startedAt,
      );
    }
  }

  private post(path: string, body: unknown) {
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async readResponseData(response: Response): Promise<unknown> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AiInvocationBadResponseError('AI 调用服务返回了非法 JSON');
    }
    const record = this.asRecord(payload);
    return record.data ?? payload;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private hasInvocationResultStatus(value: unknown) {
    const status = this.asRecord(value).status;
    return status === 'SUCCEEDED' || status === 'FAILED';
  }
}

class AiInvocationBadResponseError extends Error {}

function isBadResponseError(error: unknown): error is AiInvocationBadResponseError {
  return error instanceof AiInvocationBadResponseError;
}

function isAbortError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const data = error as { name?: unknown; message?: unknown };
  return data.name === 'AbortError' || (typeof data.message === 'string' && data.message.toLowerCase().includes('aborted'));
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefined(item)]),
  );
}
