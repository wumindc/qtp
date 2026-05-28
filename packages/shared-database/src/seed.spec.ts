import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyPassword } from '@ai-quality-platform/shared-auth';
import {
  buildInitialSeedData,
  buildDefaultDatabaseUrl,
} from './seed';

describe('shared database seed definitions', () => {
  it('requires an explicit bootstrap administrator password', () => {
    expect(() => buildInitialSeedData({})).toThrow('QTP_ADMIN_INITIAL_PASSWORD');
  });

  it('hashes the bootstrap administrator password', () => {
    const seedData = buildInitialSeedData({
      QTP_ADMIN_INITIAL_PASSWORD: 'CorrectHorseBatteryStaple',
    });

    expect(seedData.users[0]).toMatchObject({
      username: 'admin',
      roleCode: 'ADMIN',
    });
    expect(seedData.users[0]?.passwordHash).not.toContain('CorrectHorseBatteryStaple');
    expect(verifyPassword('CorrectHorseBatteryStaple', seedData.users[0]?.passwordHash ?? '')).toBe(true);
  });

  it('does not bootstrap business data', () => {
    const seedData = buildInitialSeedData({
      QTP_ADMIN_INITIAL_PASSWORD: 'CorrectHorseBatteryStaple',
    });

    expect(Object.keys(seedData)).toEqual(['users']);
    expect(seedData.users).toHaveLength(1);
  });

  it('builds a non-root local development database URL by default', () => {
    expect(buildDefaultDatabaseUrl()).toBe('mysql://qtp_app:qtp_dev_password@127.0.0.1:3306/ai_quality_platform');
  });

  it('keeps AI model JSON field names aligned with the public model contract', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const aiModelBlock = schema.match(/model AiModel \{[\s\S]*?\n\}/u)?.[0] ?? '';

    expect(aiModelBlock).toMatch(/\n\s+parameters\s+Json\n/u);
    expect(aiModelBlock).toMatch(/\n\s+capabilities\s+Json\n/u);
    expect(aiModelBlock).toMatch(/\n\s+limits\s+Json\n/u);
  });

  it('does not keep unused trace fields on persisted execution results', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const evalResultBlock = schema.match(/model EvalResult \{[\s\S]*?\n\}/u)?.[0] ?? '';

    expect(evalResultBlock).not.toMatch(/\n\s+traceId\s+/u);
  });
});
