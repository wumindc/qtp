'use client';

/**
 * 登录表单 — 完整主题感知设计，接入真实后端登录接口
 * @author Antigravity / Claude Sonnet
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Loader2,
  Lock,
  User,
  AlertCircle,
  Zap,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { postGateway } from '@/lib/api/gateway-client';
import { saveAuthSession, type StoredAuthUser } from '@/lib/auth-session';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type LoginState = 'idle' | 'loading' | 'error' | 'success';

const themeOptions = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const;

/** 右上角主题切换按钮，复用 next-themes */
function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = themeOptions.find((t) => t.value === theme) ?? themeOptions[2];
  const Icon = mounted ? current.icon : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          id="login-theme-toggle"
          aria-label="切换主题"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Icon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-36">
        {themeOptions.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={cn('cursor-pointer gap-2', theme === t.value && 'bg-accent')}
          >
            <t.icon className="h-4 w-4" />
            <span>{t.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<LoginState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('loading');
    setErrorMsg('');

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get('username') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!username || !password) {
      setState('error');
      setErrorMsg('请输入账号和密码');
      return;
    }

    try {
      const user = await postGateway<StoredAuthUser>('system', '/auth/login.do', {
        username,
        password,
      });
      saveAuthSession(user);
      setState('success');
      router.push('/ai-quality-platform/apps');
    } catch (error) {
      setState('error');
      setErrorMsg(error instanceof Error ? error.message : '登录失败，请检查账号密码');
    }
  }

  const isLoading = state === 'loading' || state === 'success';

  return (
    <div className="w-full max-w-[420px]">
      {/* 右上角主题切换 */}
      <div className="flex justify-end mb-3 pr-1">
        <ThemeButton />
      </div>

      {/* 卡片 */}
      <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-lg">
        {/* 顶部彩色渐变条 */}
        <div
          className="h-[3px] w-full rounded-t-2xl"
          style={{
            background:
              'linear-gradient(90deg, oklch(0.488 0.243 264.376), oklch(0.569 0.258 301), oklch(0.646 0.222 41.116))',
          }}
        />

        <div className="px-8 pt-8 pb-8">
          {/* Logo + 标题 */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-md">
              <Zap className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
              AI 质量平台
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              AI 应用质量评估与管理系统
            </p>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} noValidate>
            {/* 错误提示 */}
            {state === 'error' && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm leading-snug text-destructive">{errorMsg}</p>
              </div>
            )}

            {/* 账号 */}
            <div className="mb-4">
              <label
                htmlFor="login-username"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                账号
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  disabled={isLoading}
                  placeholder="请输入账号"
                  className={cn(
                    'h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm text-foreground',
                    'placeholder:text-muted-foreground',
                    'transition-colors outline-none',
                    'focus:border-ring focus:ring-2 focus:ring-ring/25',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    state === 'error'
                      ? 'border-destructive/60'
                      : 'border-input',
                  )}
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="mb-6">
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                密码
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  placeholder="请输入密码"
                  className={cn(
                    'h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm text-foreground',
                    'placeholder:text-muted-foreground',
                    'transition-colors outline-none',
                    'focus:border-ring focus:ring-2 focus:ring-ring/25',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    state === 'error'
                      ? 'border-destructive/60'
                      : 'border-input',
                  )}
                />
              </div>
            </div>

            {/* 登录按钮 */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className={cn(
                'h-10 w-full rounded-lg text-sm font-semibold transition-all',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 active:scale-[0.99]',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-70',
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {state === 'success' ? '正在进入系统…' : '验证中…'}
                </span>
              ) : (
                '登录'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* 底部版权 */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AI 质量平台 · 内部系统
      </p>
    </div>
  );
}
