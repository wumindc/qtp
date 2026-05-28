'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from './app-shell';
import { readAuthToken } from '@/lib/auth-session';

export function PlatformLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname.endsWith('/login');
  const isHealthPage = pathname.endsWith('/health');
  const isPublicPage = isLoginPage || isHealthPage;
  const [canRender, setCanRender] = useState(isPublicPage);

  /**
   * @author codex
   * Keeps the login page outside the management shell while sharing the same context path.
   */
  useEffect(() => {
    if (isPublicPage) {
      setCanRender(true);
      return;
    }
    if (!readAuthToken()) {
      setCanRender(false);
      router.replace('/ai-quality-platform/login');
      return;
    }
    setCanRender(true);
  }, [isPublicPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!canRender) return null;

  return <AppShell>{children}</AppShell>;
}
