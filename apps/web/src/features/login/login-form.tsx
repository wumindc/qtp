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
  Eye,
  EyeOff,
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
import { useLoginAnimation } from './animated-login-layout';

type LoginState = 'idle' | 'loading' | 'error' | 'success';

const themeOptions = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const;

/** 右上角主题切换按钮，复用 next-themes */
/** 右上角主题切换按钮，复用 next-themes */
export function ThemeButton() {
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
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Icon className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-36 rounded-xl">
        {themeOptions.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={cn('cursor-pointer gap-2 rounded-lg', theme === t.value && 'bg-accent')}
          >
            <t.icon className="h-4 w-4" />
            <span>{t.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type LoginFormProps = {
  onTyping?: () => void;
  onPasswordChange?: (length: number) => void;
  showPassword?: boolean;
  onShowPasswordChange?: (show: boolean) => void;
  onPasswordFocusChange?: (focused: boolean) => void;
};

export function LoginForm(props: LoginFormProps = {}) {
  const animContext = useLoginAnimation();

  const onTyping = animContext?.onTyping || props.onTyping;
  const onPasswordChange = animContext?.onPasswordChange || props.onPasswordChange;
  const showPassword = animContext?.showPassword ?? props.showPassword ?? false;
  const onShowPasswordChange = animContext?.onShowPasswordChange || props.onShowPasswordChange;
  const onPasswordFocusChange = animContext?.onPasswordFocusChange || props.onPasswordFocusChange;

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
    <div className="w-full max-w-[400px] mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out fill-mode-both">
      {/* 软阴影无边框卡片 */}
      <div className="rounded-3xl bg-card text-card-foreground shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:border dark:border-white/5 p-8 sm:p-10">
        
        {/* 标题 */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            Welcome back!
          </h1>
          <p className="text-sm text-muted-foreground">
            Please enter your details
          </p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} noValidate>
          {/* 错误提示 */}
          {state === 'error' && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 animate-in fade-in zoom-in-95 duration-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm leading-snug text-destructive">{errorMsg}</p>
            </div>
          )}

          {/* 账号 */}
          <div className="mb-5">
            <label
              htmlFor="login-username"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Email / Username
            </label>
            <div className="relative">
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                disabled={isLoading}
                placeholder="you@example.com"
                onChange={() => onTyping?.()}
                className={cn(
                  'h-12 w-full rounded-xl border bg-transparent px-4 text-sm text-foreground',
                  'placeholder:text-muted-foreground/60',
                  'transition-all outline-none',
                  'focus:border-primary focus:ring-4 focus:ring-primary/10',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  state === 'error'
                    ? 'border-destructive/60 focus:border-destructive focus:ring-destructive/10'
                    : 'border-input hover:border-border/80',
                )}
              />
            </div>
          </div>

          {/* 密码 */}
          <div className="mb-8">
            <label
              htmlFor="login-password"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isLoading}
                placeholder="••••••••"
                onChange={(e) => onPasswordChange?.(e.target.value.length)}
                onFocus={() => onPasswordFocusChange?.(true)}
                onBlur={() => onPasswordFocusChange?.(false)}
                className={cn(
                  'h-12 w-full rounded-xl border bg-transparent pl-4 pr-12 text-sm text-foreground',
                  'placeholder:text-muted-foreground/60 tracking-[0.2em]',
                  'transition-all outline-none',
                  'focus:border-primary focus:ring-4 focus:ring-primary/10',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  state === 'error'
                    ? 'border-destructive/60 focus:border-destructive focus:ring-destructive/10'
                    : 'border-input hover:border-border/80',
                )}
              />
              <button
                type="button"
                onClick={() => onShowPasswordChange?.(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* 登录按钮 */}
          <button
            id="login-submit-btn"
            type="submit"
            disabled={isLoading}
            className={cn(
              'h-12 w-full rounded-xl text-[15px] font-semibold transition-all duration-300',
              'bg-primary text-primary-foreground shadow-sm',
              'hover:bg-primary/90 hover:shadow-md active:scale-[0.98]',
              'outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
              'disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 disabled:hover:shadow-none',
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {state === 'success' ? 'Entering...' : 'Authenticating...'}
              </span>
            ) : (
              'Log in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
