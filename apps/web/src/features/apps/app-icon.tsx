'use client';

/**
 * AI application icon renderer.
 * @author codex
 */
import {
  Blocks,
  BookOpen,
  Bot,
  Brain,
  Database,
  Gauge,
  Globe2,
  MessageSquare,
  Route,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { App } from './types';

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  bot: Bot,
  message: MessageSquare,
  workflow: Workflow,
  sparkles: Sparkles,
  shield: ShieldCheck,
  brain: Brain,
  database: Database,
  search: Search,
  gauge: Gauge,
  globe: Globe2,
  book: BookOpen,
  terminal: Terminal,
  blocks: Blocks,
  route: Route,
  scan: ScanLine,
  zap: Zap,
};

const ICON_THEMES: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  violet: {
    bg: 'bg-gradient-to-br from-violet-500/18 to-indigo-500/12',
    border: 'border-violet-500/25',
    text: 'text-violet-600 dark:text-violet-300',
    accent: 'bg-violet-500/15',
  },
  indigo: {
    bg: 'bg-gradient-to-br from-indigo-500/18 to-blue-500/12',
    border: 'border-indigo-500/25',
    text: 'text-indigo-600 dark:text-indigo-300',
    accent: 'bg-indigo-500/15',
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-500/18 to-sky-500/12',
    border: 'border-blue-500/25',
    text: 'text-blue-600 dark:text-blue-300',
    accent: 'bg-blue-500/15',
  },
  cyan: {
    bg: 'bg-gradient-to-br from-cyan-500/18 to-blue-500/12',
    border: 'border-cyan-500/25',
    text: 'text-cyan-600 dark:text-cyan-300',
    accent: 'bg-cyan-500/15',
  },
  emerald: {
    bg: 'bg-gradient-to-br from-emerald-500/18 to-teal-500/12',
    border: 'border-emerald-500/25',
    text: 'text-emerald-600 dark:text-emerald-300',
    accent: 'bg-emerald-500/15',
  },
  teal: {
    bg: 'bg-gradient-to-br from-teal-500/18 to-cyan-500/12',
    border: 'border-teal-500/25',
    text: 'text-teal-600 dark:text-teal-300',
    accent: 'bg-teal-500/15',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-500/20 to-yellow-500/12',
    border: 'border-amber-500/25',
    text: 'text-amber-600 dark:text-amber-300',
    accent: 'bg-amber-500/15',
  },
  orange: {
    bg: 'bg-gradient-to-br from-orange-500/18 to-red-500/10',
    border: 'border-orange-500/25',
    text: 'text-orange-600 dark:text-orange-300',
    accent: 'bg-orange-500/15',
  },
  rose: {
    bg: 'bg-gradient-to-br from-rose-500/18 to-red-500/12',
    border: 'border-rose-500/25',
    text: 'text-rose-600 dark:text-rose-300',
    accent: 'bg-rose-500/15',
  },
  pink: {
    bg: 'bg-gradient-to-br from-pink-500/18 to-fuchsia-500/12',
    border: 'border-pink-500/25',
    text: 'text-pink-600 dark:text-pink-300',
    accent: 'bg-pink-500/15',
  },
  slate: {
    bg: 'bg-gradient-to-br from-slate-500/16 to-zinc-500/10',
    border: 'border-slate-500/25',
    text: 'text-slate-700 dark:text-slate-200',
    accent: 'bg-slate-500/15',
  },
  lime: {
    bg: 'bg-gradient-to-br from-lime-500/18 to-emerald-500/12',
    border: 'border-lime-500/25',
    text: 'text-lime-700 dark:text-lime-300',
    accent: 'bg-lime-500/15',
  },
};

const VARIANT_STYLES: Record<string, string> = {
  soft: '',
  ring: 'ring-2 ring-inset ring-white/60 dark:ring-white/10',
  glow: 'shadow-sm shadow-primary/10',
  tile: 'outline outline-1 outline-offset-[-6px] outline-white/50 dark:outline-white/10',
};

export function AppIcon({ app, className }: { app: Pick<App, 'icon'>; className?: string }) {
  const config = app.icon;
  const theme = ICON_THEMES[config.themeKey];
  const Icon = ICON_COMPONENTS[config.iconKey];

  return (
    <div
      aria-label={`应用图标：${config.iconKey}`}
      data-icon-key={config.iconKey}
      data-theme-key={config.themeKey}
      data-variant-key={config.variantKey}
      className={cn(
        'relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border',
        theme.bg,
        theme.border,
        VARIANT_STYLES[config.variantKey],
        className,
      )}
    >
      <span className={cn('absolute -right-3 -top-3 h-7 w-7 rounded-full', theme.accent)} />
      <span className={cn('absolute -bottom-4 -left-2 h-8 w-8 rounded-full', theme.accent)} />
      <Icon className={cn('relative z-10 h-6 w-6', theme.text)} />
    </div>
  );
}
