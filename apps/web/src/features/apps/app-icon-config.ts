/**
 * AI application icon preset configuration.
 * @author codex
 */
import type { AppIconConfig } from './types';

const APP_ICON_KEYS = [
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

const APP_ICON_THEME_KEYS = [
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

const APP_ICON_VARIANT_KEYS = ['soft', 'ring', 'glow', 'tile'] as const;

export function normalizeAppIconConfig(value: unknown): AppIconConfig | undefined {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const { iconKey, themeKey, variantKey } = record;
  if (
    typeof iconKey === 'string' &&
    typeof themeKey === 'string' &&
    typeof variantKey === 'string' &&
    (APP_ICON_KEYS as readonly string[]).includes(iconKey) &&
    (APP_ICON_THEME_KEYS as readonly string[]).includes(themeKey) &&
    (APP_ICON_VARIANT_KEYS as readonly string[]).includes(variantKey)
  ) {
    return { iconKey, themeKey, variantKey };
  }
  return undefined;
}
