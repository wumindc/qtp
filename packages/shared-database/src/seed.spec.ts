import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN,
  buildInitialSeedData,
  toPrismaSeedOperations,
} from './seed';

describe('shared database seed definitions', () => {
  it('defines the default local administrator account', () => {
    expect(DEFAULT_ADMIN.username).toBe('admin');
    expect(DEFAULT_ADMIN.initialPassword).toBe('admin123456');
    expect(DEFAULT_ADMIN.roleCode).toBe('ADMIN');
  });

  it('does not bootstrap business data', () => {
    const seedData = buildInitialSeedData();

    expect(seedData.users).toHaveLength(1);
    expect(seedData.categories).toEqual([]);
    expect(seedData.apps).toEqual([]);
    expect(seedData.presetCases).toEqual([]);
    expect(seedData.cases).toEqual([]);
    expect(seedData.plans).toEqual([]);
    expect(seedData.runs).toEqual([]);
    expect(seedData.reports).toEqual([]);
  });

  it('converts bootstrap data to ordered Prisma seed operations', () => {
    const operations = toPrismaSeedOperations(buildInitialSeedData());

    expect(operations.map((operation) => operation.model)).toEqual([
      'user',
      'evalCaseCategory',
      'aiApp',
      'evalCase',
      'evalPlan',
      'evalRun',
      'evalReport',
    ]);
    expect(operations[0]?.records[0]).toMatchObject({ username: 'admin' });
    expect(operations.slice(1).every((operation) => operation.records.length === 0)).toBe(true);
  });
});
