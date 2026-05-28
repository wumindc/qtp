/**
 * 登录页 — 主题感知背景，居中卡片布局
 * @author Antigravity / Claude Sonnet
 */
import type { Metadata } from 'next';
import { LoginForm } from '../../../features/login/login-form';

export const metadata: Metadata = {
  title: '登录 — AI 质量平台',
  description: 'AI 应用质量评估平台登录入口',
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* 装饰光晕：使用 primary 颜色，自动跟随主题 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'var(--color-primary)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 right-0 h-[400px] w-[500px] rounded-full opacity-[0.05] blur-3xl"
        style={{ background: 'oklch(0.488 0.243 264.376)' }}
      />

      {/* 表单区 */}
      <div className="relative z-10 w-full flex justify-center">
        <LoginForm />
      </div>
    </main>
  );
}
