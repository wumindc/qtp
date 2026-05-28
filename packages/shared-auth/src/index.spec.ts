import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createAuthToken,
  hashPassword,
  readAuthTokenSecret,
  verifyAuthToken,
  verifyPassword,
} from './index';

describe('shared auth primitives', () => {
  it('does not decode malformed token JSON as an empty object fallback', () => {
    const source = readFileSync(join(process.cwd(), 'src/index.ts'), 'utf8');

    expect(source).not.toContain('return {};');
  });

  it('hashes administrator passwords instead of storing plaintext', () => {
    const hash = hashPassword('CorrectHorseBatteryStaple', { salt: 'fixed-salt' });

    expect(hash).not.toContain('CorrectHorseBatteryStaple');
    expect(hash).toMatch(/^scrypt:/);
    expect(verifyPassword('CorrectHorseBatteryStaple', hash)).toBe(true);
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('creates and verifies signed auth tokens', () => {
    const token = createAuthToken(
      { username: 'admin', displayName: '系统管理员', roleCode: 'ADMIN' },
      'unit-test-secret',
      { nowMs: 1_000, ttlSeconds: 60 },
    );

    expect(token).not.toContain('local-admin-token');
    expect(verifyAuthToken(token, 'unit-test-secret', { nowMs: 30_000 })).toMatchObject({
      username: 'admin',
      roleCode: 'ADMIN',
    });
    expect(verifyAuthToken(token, 'bad-secret', { nowMs: 30_000 })).toBeNull();
    expect(verifyAuthToken(token, 'unit-test-secret', { nowMs: 90_000 })).toBeNull();
  });

  it('requires an explicit production token secret', () => {
    expect(() => readAuthTokenSecret({ NODE_ENV: 'production' })).toThrow('QTP_AUTH_TOKEN_SECRET');
    expect(readAuthTokenSecret({ NODE_ENV: 'development' })).toBeTruthy();
    expect(readAuthTokenSecret({ QTP_AUTH_TOKEN_SECRET: 'configured-secret' })).toBe('configured-secret');
  });
});
