import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from './providers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('AppProviders', () => {
  it('renders children inside global frontend providers', () => {
    render(
      <AppProviders>
        <button type="button">Provider smoke child</button>
      </AppProviders>,
    );

    expect(screen.getByRole('button', { name: 'Provider smoke child' })).toBeInTheDocument();
  });
});
