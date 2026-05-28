import { Body, Controller, Post } from '@nestjs/common';
import {
  createChatCompletionsProviderAdapter,
  createEmbeddingsProviderAdapter,
  createModelDiscoveryProviderAdapter,
} from '@ai-quality-platform/ai-model-adapter';
import {
  type EmbeddingInvocationRequest,
  type ModelDiscoveryRequest,
  type ModelInvocationRequest,
} from '@ai-quality-platform/ai-invocation-contract';
import { ok } from '@ai-quality-platform/shared-http';

interface AiInvocationConnection {
  baseUrl: string;
  apiKey: string;
}

interface ChatInvocationBody {
  connection: AiInvocationConnection;
  request: ModelInvocationRequest;
}

interface EmbeddingInvocationBody {
  connection: AiInvocationConnection;
  request: EmbeddingInvocationRequest;
}

interface ModelDiscoveryBody {
  connection: AiInvocationConnection;
  request: ModelDiscoveryRequest;
}

@Controller('ai-quality-platform/model')
export class ModelInvocationController {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  /**
   * @author codex
   * Invokes chat models from the internal service boundary instead of callers reaching providers directly.
   */
  @Post('chat/invoke.do')
  async invokeChat(@Body() body: ChatInvocationBody) {
    const adapter = createChatCompletionsProviderAdapter({
      baseUrl: body.connection.baseUrl,
      apiKey: body.connection.apiKey,
      fetchImpl: this.fetchImpl,
    });
    return ok(await adapter.invoke(body.request));
  }

  /**
   * @author codex
   * Invokes embedding models from the internal service boundary.
   */
  @Post('embedding/invoke.do')
  async invokeEmbedding(@Body() body: EmbeddingInvocationBody) {
    const adapter = createEmbeddingsProviderAdapter({
      baseUrl: body.connection.baseUrl,
      apiKey: body.connection.apiKey,
      fetchImpl: this.fetchImpl,
    });
    return ok(await adapter.invoke(body.request));
  }

  /**
   * @author codex
   * Discovers provider model lists from the internal AI invocation boundary.
   */
  @Post('models/list.do')
  async listModels(@Body() body: ModelDiscoveryBody) {
    const adapter = createModelDiscoveryProviderAdapter({
      baseUrl: body.connection.baseUrl,
      apiKey: body.connection.apiKey,
      fetchImpl: this.fetchImpl,
    });
    return ok(await adapter.listModels(body.request));
  }
}
