import { QueryClient } from '@tanstack/react-query';

/**
 * @author codex
 * Creates a query client with conservative defaults for management-console screens.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 30_000,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
