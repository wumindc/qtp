import { describe, expect, it } from 'vitest';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  it('wraps login result in the platform response envelope', async () => {
    const controller = new AuthController({
      login: async () => ({
        username: 'admin',
        displayName: '系统管理员',
        roleCode: 'ADMIN',
        token: 'signed-token',
      }),
      logout: async () => ({ revoked: true }),
    });

    const response = await controller.login({
      username: 'admin',
      password: 'CorrectHorseBatteryStaple',
    });

    expect(response.success).toBe(true);
    expect(response.data.username).toBe('admin');
    expect(response.data.token).toBe('signed-token');
  });

  it('wraps stateless logout in the platform response envelope', async () => {
    const controller = new AuthController({
      login: async () => {
        throw new Error('not used');
      },
      logout: async () => ({ revoked: true }),
    });

    const response = await controller.logout();

    expect(response.success).toBe(true);
    expect(response.data.revoked).toBe(true);
  });
});
