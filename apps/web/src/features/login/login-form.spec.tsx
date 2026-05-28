import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('LoginForm', () => {
  it('renders login fields without exposing bootstrap credentials', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText('账号')).toHaveAttribute('placeholder', '请输入账号');
    expect(screen.getByLabelText('密码')).toHaveAttribute('placeholder', '请输入密码');
    expect(screen.queryByText(/admin123456/u)).not.toBeInTheDocument();
    expect(screen.getByText('登录')).toBeInTheDocument();
  });
});
