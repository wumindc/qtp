import { render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from './providers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('AppProviders', () => {
  it('renders children inside global frontend providers', () => {
    function QueryClientSmokeMarker() {
      const queryClient = useQueryClient();

      return queryClient ? <span>Query client provider ready</span> : null;
    }

    render(
      <AppProviders>
        <button type="button">Provider smoke child</button>
        <QueryClientSmokeMarker />
      </AppProviders>,
    );

    expect(screen.getByRole('button', { name: 'Provider smoke child' })).toBeInTheDocument();
    expect(screen.getByText('Query client provider ready')).toBeInTheDocument();
  });
});
