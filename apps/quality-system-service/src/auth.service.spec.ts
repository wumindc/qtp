import { describe, expect, it } from 'vitest';
import { DEFAULT_ADMIN } from '@ai-quality-platform/shared-database';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('returns a token for the default administrator account', async () => {
    const service = new AuthService();

    const result = await service.login({
      username: DEFAULT_ADMIN.username,
      password: DEFAULT_ADMIN.initialPassword,
    });

    expect(result.username).toBe('admin');
    expect(result.displayName).toBe('系统管理员');
    expect(result.roleCode).toBe('ADMIN');
    expect(result.token).toMatch(/^local-admin-token-/);
  });

  it('rejects invalid credentials', async () => {
    const service = new AuthService();

    await expect(
      service.login({
        username: 'admin',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('用户名或密码错误');
  });
});
