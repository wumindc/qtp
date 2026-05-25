'use client';

/**
 * 全局 Provider 组合（简化版，移除 @heroui 依赖）
 * ThemeProvider 已移至 layout.tsx，此文件仅保留其他全局状态
 * @author Antigravity/Gemini
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/lib/api/query-client';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
