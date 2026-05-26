/**
 * AI application icon preset configuration.
 * @author codex
 */
import type { App, AppIconConfig } from './types';

export const APP_ICON_KEYS = [
  'bot',
  'message',
  'workflow',
  'sparkles',
  'shield',
  'brain',
  'database',
  'search',
  'gauge',
  'globe',
  'book',
  'terminal',
  'blocks',
  'route',
  'scan',
  'zap',
] as const;

export const APP_ICON_THEME_KEYS = [
  'violet',
  'indigo',
  'blue',
  'cyan',
  'emerald',
  'teal',
  'amber',
  'orange',
  'rose',
  'pink',
  'slate',
  'lime',
] as const;

export const APP_ICON_VARIANT_KEYS = ['soft', 'ring', 'glow', 'tile'] as const;

const TOTAL_COMBINATIONS = APP_ICON_KEYS.length * APP_ICON_THEME_KEYS.length * APP_ICON_VARIANT_KEYS.length;

function selectByIndex(index: number): AppIconConfig {
  const safeIndex = Math.abs(index) % TOTAL_COMBINATIONS;
  const iconIndex = safeIndex % APP_ICON_KEYS.length;
  const themeIndex = Math.floor(safeIndex / APP_ICON_KEYS.length) % APP_ICON_THEME_KEYS.length;
  const variantIndex = Math.floor(safeIndex / (APP_ICON_KEYS.length * APP_ICON_THEME_KEYS.length)) % APP_ICON_VARIANT_KEYS.length;
  return {
    iconKey: APP_ICON_KEYS[iconIndex],
    themeKey: APP_ICON_THEME_KEYS[themeIndex],
    variantKey: APP_ICON_VARIANT_KEYS[variantIndex],
  };
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function normalizeAppIconConfig(value: unknown): AppIconConfig | undefined {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const iconKey = String(record.iconKey ?? '');
  const themeKey = String(record.themeKey ?? '');
  const variantKey = String(record.variantKey ?? '');
  if (
    (APP_ICON_KEYS as readonly string[]).includes(iconKey) &&
    (APP_ICON_THEME_KEYS as readonly string[]).includes(themeKey) &&
    (APP_ICON_VARIANT_KEYS as readonly string[]).includes(variantKey)
  ) {
    return { iconKey, themeKey, variantKey };
  }
  return undefined;
}

export function resolveAppIconConfig(app: Pick<App, 'appCode' | 'appName' | 'icon'>): AppIconConfig {
  return normalizeAppIconConfig(app.icon) ?? selectByIndex(hashSeed(`${app.appCode}:${app.appName}`));
}
