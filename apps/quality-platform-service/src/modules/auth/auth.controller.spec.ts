import { describe, expect, it } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  it('wraps login result in the platform response envelope', async () => {
    const controller = new AuthController(new AuthService());

    const response = await controller.login({
      username: 'admin',
      password: 'admin123456',
    });

    expect(response.success).toBe(true);
    expect(response.data.username).toBe('admin');
    expect(response.data.token).toMatch(/^local-admin-token-/);
  });
});
