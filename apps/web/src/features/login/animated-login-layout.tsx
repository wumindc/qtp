'use client';

/**
 * 带有交互式插画的通用登录布局组件
 * 左侧显示全屏交互式插画，右侧显示传入的表单组件
 * @author Antigravity / Gemini 3.1 Pro
 */

import { ReactNode, useState, createContext, useContext } from 'react';
import { LoginIllustration } from './login-illustration';
import { TotoroIllustration } from './totoro-illustration';

export interface AnimationProps {
  onTyping: () => void;
  passwordLength: number;
  onPasswordChange: (len: number) => void;
  showPassword: boolean;
  onShowPasswordChange: (show: boolean) => void;
  isPasswordFocused: boolean;
  onPasswordFocusChange: (focused: boolean) => void;
  typingPulse: number;
}

const LoginAnimationContext = createContext<AnimationProps | null>(null);

export function useLoginAnimation() {
  return useContext(LoginAnimationContext);
}

export interface AnimatedLoginLayoutProps {
  /** 品牌 Logo */
  logo?: ReactNode;
  /** 主标题 */
  title?: ReactNode;
  /** 副标题 */
  subtitle?: ReactNode;
  /** 底部文案 */
  footer?: ReactNode;
  /** 左侧背景类名（用于支持深色模式等 tailwind 类） */
  leftPanelClassName?: string;
  /** 右侧背景类名 */
  rightPanelClassName?: string;
  /** 右上角附加元素（如主题切换） */
  topRight?: ReactNode;
  /** 右侧表单内容 */
  children: ReactNode;
}

export function AnimatedLoginLayout({
  logo,
  title,
  subtitle,
  footer,
  leftPanelClassName = 'bg-[#F4F5FB] dark:bg-zinc-900',
  rightPanelClassName = 'bg-[#F4F5FB] lg:bg-white dark:bg-zinc-900 lg:dark:bg-zinc-950',
  topRight,
  children,
}: AnimatedLoginLayoutProps) {
  const [typingPulse, setTypingPulse] = useState(0);
  const [passwordLength, setPasswordLength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const contextValue: AnimationProps = {
    onTyping: () => setTypingPulse((prev) => prev + 1),
    passwordLength,
    onPasswordChange: setPasswordLength,
    showPassword,
    onShowPasswordChange: setShowPassword,
    isPasswordFocused,
    onPasswordFocusChange: setIsPasswordFocused,
    typingPulse,
  };

  return (
    <LoginAnimationContext.Provider value={contextValue}>
      <div className="flex min-h-screen w-full">
        {/* ── 左侧：品牌 + 交互式插画 ── */}
        <div 
          className={`relative flex-1 hidden lg:flex flex-col items-center justify-center overflow-hidden ${leftPanelClassName}`}
        >
          {/* 顶部 Logo & Title */}
          <div className="absolute top-10 left-12 flex flex-col gap-2 z-20">
            <div className="flex items-center gap-3">
              {logo}
              {title && <span className="text-xl font-bold text-foreground/90">{title}</span>}
            </div>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>

          {/* 中间的插画，增加放大效果以填满一半屏幕，并固定到底部 */}
          <div className="relative z-10 scale-[0.8] xl:scale-100 transform-origin-bottom flex items-end h-[400px]">
            <LoginIllustration
              typingPulse={typingPulse}
              passwordLength={passwordLength}
              showPassword={showPassword}
            />
          </div>

          {/* 底部文字 */}
          {footer && (
            <div className="absolute bottom-8 left-12 text-sm text-muted-foreground z-20">
              {footer}
            </div>
          )}
        </div>

        {/* ── 右侧：登录表单 ── */}
        <div 
          className={`flex-1 flex flex-col items-center justify-center relative ${rightPanelClassName}`}
        >
          {topRight && (
            <div className="absolute top-6 right-8 z-20">
              {topRight}
            </div>
          )}
          
          <div className="relative w-full max-w-[420px] flex flex-col items-center z-10 mt-[100px] lg:mt-0">
            {/* ── 移动端专属：趴在卡片上方的躲猫猫龙猫 ── */}
            <div className="absolute bottom-full mb-[-10px] left-0 right-0 flex justify-center lg:hidden pointer-events-none z-20">
              <div className="origin-bottom scale-[0.7] sm:scale-[0.8] translate-y-[20px]">
                <TotoroIllustration
                  typingPulse={typingPulse}
                  passwordLength={passwordLength}
                  showPassword={showPassword}
                  isPasswordFocused={isPasswordFocused}
                />
              </div>
            </div>

            <div className="w-full px-4 sm:px-0 relative z-10">
              {children}
            </div>
          </div>
        </div>
      </div>
    </LoginAnimationContext.Provider>
  );
}
