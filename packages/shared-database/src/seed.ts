import { PrismaMariaDb } from '@prisma/adapter-mariadb';

export interface SeedUser {
  username: string;
  displayName: string;
  initialPassword: string;
  roleCode: string;
}

export interface SeedCaseCategory {
  id: string;
  appCode?: string;
  name: string;
  description: string;
  sortOrder?: number;
}

export interface SeedApp {
  appCode: string;
  appName: string;
  appType: string;
  businessDomain: string;
  invokeUrl: string;
}

export interface SeedCase {
  id: string;
  caseName: string;
  appCode: string;
  caseScope?: 'APP' | 'SYSTEM_PRESET';
  categoryId: string;
  sourcePresetId?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  query: string;
  expectedBehavior: string;
  caseCode?: string;
  categoryCode?: string;
}

export interface SeedPlan {
  planCode: string;
  planName: string;
  appCode: string;
  planType: 'SMOKE' | 'FULL_REGRESSION' | 'HIGH_RISK';
}

export interface SeedRun {
  runCode: string;
  planCode: string;
  appCode: string;
  status: 'COMPLETED';
}

export interface SeedReport {
  reportCode: string;
  runCode: string;
  reportName: string;
}

export interface InitialSeedData {
  users: SeedUser[];
  categories: SeedCaseCategory[];
  apps: SeedApp[];
  presetCases: SeedCase[];
  cases: SeedCase[];
  plans: SeedPlan[];
  runs: SeedRun[];
  reports: SeedReport[];
}

export interface PrismaSeedOperation {
  model: 'user' | 'evalCaseCategory' | 'aiApp' | 'evalCase' | 'evalPlan' | 'evalRun' | 'evalReport';
  records: SeedRecord[];
}

type SeedRecord = {
  username?: string;
  id?: string;
  appCode?: string | null;
  caseName?: string;
  planCode?: string;
  runCode?: string;
  reportCode?: string;
} & object;

type PrismaUpsertDelegate = {
  upsert(input: { where: object; create: object; update: object }): Promise<unknown>;
};

type SeedPrismaClient = {
  user: PrismaUpsertDelegate;
  $disconnect(): Promise<void>;
};

type PrismaClientConstructor = new (options?: { adapter?: unknown }) => SeedPrismaClient;

export const DEFAULT_ADMIN: SeedUser = {
  username: 'admin',
  displayName: '系统管理员',
  initialPassword: 'admin123456',
  roleCode: 'ADMIN',
};

export const SYSTEM_PRESET_APP_CODE = 'SYSTEM_PRESET';

/**
 * @author codex
 * Builds only platform bootstrap data; all business records must be created through services and stored in MySQL.
 */
export function buildInitialSeedData(): InitialSeedData {
  return {
    users: [DEFAULT_ADMIN],
    categories: [],
    apps: [],
    presetCases: [],
    cases: [],
    plans: [],
    runs: [],
    reports: [],
  };
}

/**
 * @author codex
 * Converts bootstrap data into ordered Prisma upsert payload groups.
 */
export function toPrismaSeedOperations(seedData: InitialSeedData): PrismaSeedOperation[] {
  return [
    {
      model: 'user',
      records: seedData.users.map((user) => ({
        username: user.username,
        displayName: user.displayName,
        passwordHash: user.initialPassword,
        roleCode: user.roleCode,
        enabled: true,
      })),
    },
    { model: 'evalCaseCategory', records: [] },
    { model: 'aiApp', records: [] },
    { model: 'evalCase', records: [] },
    { model: 'evalPlan', records: [] },
    { model: 'evalRun', records: [] },
    { model: 'evalReport', records: [] },
  ];
}

/**
 * @author codex
 * Seeds MySQL through Prisma when invoked via the package seed script.
 */
async function runSeed() {
  const { PrismaClient } = (await import('@prisma/client')) as unknown as {
    PrismaClient: PrismaClientConstructor;
  };
  const prisma = new PrismaClient({ adapter: createMariaDbAdapter() });
  const seedData = buildInitialSeedData();

  try {
    for (const operation of toPrismaSeedOperations(seedData)) {
      if (operation.model !== 'user') continue;
      for (const record of operation.records) {
        await prisma.user.upsert({
          where: { username: record.username },
          create: record,
          update: record,
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * @author codex
 * Parses DATABASE_URL or local defaults into the Prisma MariaDB adapter required by Prisma 7.
 */
export function createMariaDbAdapter(databaseUrl = buildDefaultDatabaseUrl()) {
  const url = new URL(databaseUrl);
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  });
}

/**
 * @author codex
 * Creates a generated Prisma client without each service importing adapter internals.
 */
export async function createRuntimePrismaClient<T>(): Promise<T> {
  const { PrismaClient } = (await import('@prisma/client')) as unknown as {
    PrismaClient: new (options?: { adapter?: unknown }) => T;
  };
  return new PrismaClient({ adapter: createMariaDbAdapter() });
}

/**
 * @author codex
 * Builds the local development database URL used by all services when DATABASE_URL is omitted.
 */
export function buildDefaultDatabaseUrl() {
  const host = process.env.MYSQL_HOST ?? '127.0.0.1';
  const port = process.env.MYSQL_PORT ?? '3306';
  const user = encodeURIComponent(process.env.MYSQL_USER ?? 'root');
  const password = encodeURIComponent(process.env.MYSQL_PASSWORD ?? 'root');
  const database = process.env.MYSQL_DATABASE ?? 'ai_quality_platform';
  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

if (process.argv[1]?.endsWith('seed.ts')) {
  void runSeed();
}
