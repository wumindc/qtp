/**
 * 登录页 — 主题感知背景，居中卡片布局
 * @author Antigravity / Claude Sonnet
 */
import { Metadata } from 'next';
import { Zap } from 'lucide-react';
import { AnimatedLoginLayout } from '../../../features/login/animated-login-layout';
import { LoginForm, ThemeButton } from '../../../features/login/login-form';

export const metadata: Metadata = {
  title: '登录 | QTP 质量平台',
  description: 'AI 质量平台 - 高效、安全的 AI 应用质量评估体验',
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <AnimatedLoginLayout
        logo={
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.488_0.243_264.376)] shadow">
            <Zap className="h-4 w-4 text-white" />
          </div>
        }
        title="QTP 质量平台"
        subtitle="高效、安全、智能的 AI 质量评估体验"
        footer="© 2026 AI 质量平台 · 内部系统"
        topRight={<ThemeButton />}
      >
        <LoginForm />
      </AnimatedLoginLayout>
    </div>
  );
}
