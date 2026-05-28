import { describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyAuthToken } from '@ai-quality-platform/shared-auth';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('authenticates enabled database users with hashed passwords', async () => {
    const userStore = {
      findByUsername: vi.fn().mockResolvedValue({
        username: 'admin',
        displayName: '系统管理员',
        roleCode: 'ADMIN',
        passwordHash: hashPassword('CorrectHorseBatteryStaple', { salt: 'auth-service-test' }),
        enabled: true,
      }),
    };
    const service = new AuthService(userStore, 'unit-test-secret');

    const result = await service.login({
      username: 'admin',
      password: 'CorrectHorseBatteryStaple',
    });

    expect(result.username).toBe('admin');
    expect(result.displayName).toBe('系统管理员');
    expect(result.roleCode).toBe('ADMIN');
    expect(result.token).not.toContain('local-admin-token');
    expect(verifyAuthToken(result.token, 'unit-test-secret')).toMatchObject({ username: 'admin' });
  });

  it('rejects invalid credentials', async () => {
    const service = new AuthService({
      findByUsername: vi.fn().mockResolvedValue({
        username: 'admin',
        displayName: '系统管理员',
        roleCode: 'ADMIN',
        passwordHash: hashPassword('CorrectHorseBatteryStaple', { salt: 'auth-service-test' }),
        enabled: true,
      }),
    }, 'unit-test-secret');

    await expect(
      service.login({
        username: 'admin',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('用户名或密码错误');
  });

  it('rejects disabled users', async () => {
    const service = new AuthService({
      findByUsername: vi.fn().mockResolvedValue({
        username: 'admin',
        displayName: '系统管理员',
        roleCode: 'ADMIN',
        passwordHash: hashPassword('CorrectHorseBatteryStaple', { salt: 'auth-service-test' }),
        enabled: false,
      }),
    }, 'unit-test-secret');

    await expect(
      service.login({
        username: 'admin',
        password: 'CorrectHorseBatteryStaple',
      }),
    ).rejects.toThrow('用户已停用');
  });
});
