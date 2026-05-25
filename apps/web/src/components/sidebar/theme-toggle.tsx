/**
 * 侧边栏主题切换组件
 * 参照 design-deploy/frontend/src/components/layout/theme-toggle.tsx，1:1 还原
 * @author Antigravity/Gemini
 */
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const themes = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const;

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR 期间渲染占位，避免 hydration 不匹配
  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          collapsed && 'justify-center px-2',
        )}
      >
        <Monitor className="h-4 w-4 shrink-0" />
        {!collapsed && <span>主题</span>}
      </button>
    );
  }

  const currentTheme = themes.find((t) => t.value === theme) ?? themes[2];
  const CurrentIcon = currentTheme.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            collapsed && 'justify-center px-2',
          )}
        >
          <CurrentIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{currentTheme.label}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={collapsed ? 'center' : 'start'}
        side="top"
        className="w-40"
      >
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={cn('gap-2 cursor-pointer', theme === t.value && 'bg-accent')}
          >
            <t.icon className="h-4 w-4" />
            <span>{t.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
