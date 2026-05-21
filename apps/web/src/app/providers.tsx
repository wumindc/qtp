'use client';

import { RouterProvider } from '@heroui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/lib/api/query-client';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * @author codex
 * Wires global UI and data providers while preserving Next App Router navigation.
 */
export function AppProviders({ children }: AppProvidersProps) {
  const router = useRouter();
  const [queryClient] = useState(() => createQueryClient());

  return (
    <RouterProvider navigate={router.push}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </RouterProvider>
  );
}
