/**
 * 前端错误对象读取工具
 * @author codex
 */
function asErrorRecord(error: unknown): Record<string, unknown> {
  return error && typeof error === 'object' && !Array.isArray(error) ? error as Record<string, unknown> : {};
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  const message = asErrorRecord(error).message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return true;
  return asErrorRecord(error).name === 'AbortError';
}
