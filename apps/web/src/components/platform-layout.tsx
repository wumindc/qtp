'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from './app-shell';

export function PlatformLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  /**
   * @author codex
   * Keeps the login page outside the management shell while sharing the same context path.
   */
  if (pathname.endsWith('/login')) {
    return <>{children}</>;
  }

  return <AppShell currentPath={pathname}>{children}</AppShell>;
}
