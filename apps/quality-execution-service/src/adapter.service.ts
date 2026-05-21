export interface SseParseConfig {
  deltaPath: string;
  doneMarker: string;
  errorPath: string;
}

export interface SseParseResult {
  answer: string;
  error?: string;
  rawEvents: string[];
}

export class AdapterService {
  /**
   * @author codex
   * Extracts a value from a JSON object using a small JSONPath subset.
   */
  extractJson(payload: unknown, path: string): string | undefined {
    const keys = path.replace(/^\$\./, '').split('.');
    let current: unknown = payload;
    for (const key of keys) {
      if (typeof current !== 'object' || current === null || !(key in current)) return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return typeof current === 'string' ? current : current == null ? undefined : String(current);
  }

  /**
   * @author codex
   * Aggregates SSE data events into a final answer for non-uniform streaming apps.
   */
  parseSse(rawStream: string, config: SseParseConfig): SseParseResult {
    const rawEvents: string[] = [];
    let answer = '';
    let error: string | undefined;

    for (const line of rawStream.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice('data:'.length).trim();
      rawEvents.push(data);
      if (data === config.doneMarker) break;

      try {
        const json = JSON.parse(data) as unknown;
        const eventError = this.extractJson(json, config.errorPath);
        if (eventError) error = eventError;
        answer += this.extractJson(json, config.deltaPath) ?? '';
      } catch {
        error = '流式响应解析失败';
      }
    }

    return { answer, error, rawEvents };
  }
}
