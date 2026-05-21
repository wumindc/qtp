import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  it('renders default administrator login fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText('账号')).toHaveAttribute('placeholder', 'admin');
    expect(screen.getByLabelText('密码')).toHaveAttribute('placeholder', 'admin123456');
    expect(screen.getByText('登录')).toBeInTheDocument();
  });
});
