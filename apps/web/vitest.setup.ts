import '@testing-library/jest-dom/vitest';

/**
 * @author codex
 * Radix Popover measures trigger/content size; jsdom does not provide ResizeObserver.
 */
class ResizeObserverMock {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver ??= ResizeObserverMock;
