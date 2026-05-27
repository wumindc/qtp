/**
 * AI application icon preset utilities.
 * @author codex
 */
import { randomInt } from 'node:crypto';

export interface AppIconConfig {
  iconKey: string;
  themeKey: string;
  variantKey: string;
}

const ICON_KEYS = [
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

const THEME_KEYS = [
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

const VARIANT_KEYS = ['soft', 'ring', 'glow', 'tile'] as const;

const TOTAL_COMBINATIONS = ICON_KEYS.length * THEME_KEYS.length * VARIANT_KEYS.length;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function selectByIndex(index: number): AppIconConfig {
  const safeIndex = Math.abs(index) % TOTAL_COMBINATIONS;
  const iconIndex = safeIndex % ICON_KEYS.length;
  const themeIndex = Math.floor(safeIndex / ICON_KEYS.length) % THEME_KEYS.length;
  const variantIndex = Math.floor(safeIndex / (ICON_KEYS.length * THEME_KEYS.length)) % VARIANT_KEYS.length;
  return {
    iconKey: ICON_KEYS[iconIndex],
    themeKey: THEME_KEYS[themeIndex],
    variantKey: VARIANT_KEYS[variantIndex],
  };
}

export function createRandomAppIconConfig(): AppIconConfig {
  return selectByIndex(randomInt(TOTAL_COMBINATIONS));
}

export function createStableAppIconConfig(seed: string): AppIconConfig {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return selectByIndex(hash >>> 0);
}

export function normalizeAppIconConfig(value: unknown): AppIconConfig | undefined {
  const record = asRecord(value);
  const iconKey = String(record.iconKey ?? '');
  const themeKey = String(record.themeKey ?? '');
  const variantKey = String(record.variantKey ?? '');
  if (
    (ICON_KEYS as readonly string[]).includes(iconKey) &&
    (THEME_KEYS as readonly string[]).includes(themeKey) &&
    (VARIANT_KEYS as readonly string[]).includes(variantKey)
  ) {
    return { iconKey, themeKey, variantKey };
  }
  return undefined;
}
