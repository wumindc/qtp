import { All, Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import type { BackendServiceKey } from '@ai-quality-platform/shared-config';
import { buildGatewayTargetUrl } from './gateway-router';

type SupportedMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type GatewayHttpRequest = {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

type GatewayHttpResponse = {
  status(code: number): GatewayHttpResponse;
  setHeader(name: string, value: string): void;
  json(data: unknown): void;
  write?(chunk: string): void;
  end?(): void;
};

@Controller('ai-quality-platform/api')
export class GatewayController {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  /**
   * @author codex
   * Forwards public gateway calls to the selected internal service.
   */
  @All(':service/*path')
  async forwardAll(
    @Param('service') service: BackendServiceKey,
    @Param('path') path: string | string[],
    @Req() request: GatewayHttpRequest,
    @Body() body: unknown,
    @Res() response: GatewayHttpResponse,
  ) {
    return this.forwardHttp(
      service,
      this.normalizePath(path),
      {
        method: request.method,
        query: request.query,
        body,
      },
      response,
    );
  }

  @Get(':service/*path')
  async forwardGet(@Param('service') service: BackendServiceKey, @Param('path') path: string) {
    return this.forward(service, path, undefined, 'GET');
  }

  @Post(':service/*path')
  async forwardPost(
    @Param('service') service: BackendServiceKey,
    @Param('path') path: string,
    @Body() body: unknown,
  ) {
    return this.forward(service, path, body, 'POST');
  }

  async forward(
    service: BackendServiceKey,
    path: string,
    body?: unknown,
    method: SupportedMethod = body === undefined ? 'GET' : 'POST',
  ) {
    const response = await this.fetchImpl(this.buildTargetUrl(service, path), {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });

    return response.json();
  }

  /**
   * @author codex
   * Preserves HTTP details for the real gateway route, including query strings and SSE streams.
   */
  async forwardHttp(
    service: BackendServiceKey,
    path: string,
    request: GatewayHttpRequest,
    response: GatewayHttpResponse,
  ) {
    const method = this.normalizeMethod(request.method);
    const upstream = await this.fetchImpl(this.buildTargetUrl(service, path, request.query), {
      method,
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(request.body ?? {}),
    });

    const contentType = upstream.headers.get('Content-Type') ?? '';
    response.status(upstream.status);

    if (contentType.includes('text/event-stream')) {
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      await this.pipeStream(upstream.body, response);
      return undefined;
    }

    response.json(await upstream.json());
    return undefined;
  }

  private normalizePath(path: string | string[]): string {
    return Array.isArray(path) ? path.join('/') : path;
  }

  private normalizeMethod(method?: string): SupportedMethod {
    const upperMethod = method?.toUpperCase();
    if (
      upperMethod === 'POST' ||
      upperMethod === 'PUT' ||
      upperMethod === 'PATCH' ||
      upperMethod === 'DELETE'
    ) {
      return upperMethod;
    }
    return 'GET';
  }

  private buildTargetUrl(
    service: BackendServiceKey,
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const targetUrl = new URL(buildGatewayTargetUrl(service, path));
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        targetUrl.searchParams.set(key, String(value));
      }
    }
    return targetUrl.toString();
  }

  private async pipeStream(stream: ReadableStream<Uint8Array> | null, response: GatewayHttpResponse) {
    if (!stream) {
      response.end?.();
      return;
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        response.write?.(decoder.decode(value, { stream: true }));
      }
      const rest = decoder.decode();
      if (rest) {
        response.write?.(rest);
      }
    } finally {
      response.end?.();
      reader.releaseLock();
    }
  }
}
