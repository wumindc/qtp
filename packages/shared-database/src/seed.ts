import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { hashPassword } from '@ai-quality-platform/shared-auth';

export interface SeedUser {
  username: string;
  displayName: string;
  passwordHash: string;
  roleCode: string;
}

export interface InitialSeedData {
  users: SeedUser[];
}

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
  passwordHash: '',
  roleCode: 'ADMIN',
};

/**
 * @author codex
 * Builds only platform bootstrap data; all business records must be created through services and stored in MySQL.
 */
export function buildInitialSeedData(env: Record<string, string | undefined> = process.env): InitialSeedData {
  return {
    users: [buildBootstrapAdmin(env)],
  };
}

function buildBootstrapAdmin(env: Record<string, string | undefined>): SeedUser {
  const password = env.QTP_ADMIN_INITIAL_PASSWORD?.trim();
  if (!password) {
    throw new Error('QTP_ADMIN_INITIAL_PASSWORD must be configured before seeding the bootstrap administrator');
  }
  return {
    username: env.QTP_ADMIN_USERNAME?.trim() || DEFAULT_ADMIN.username,
    displayName: env.QTP_ADMIN_DISPLAY_NAME?.trim() || DEFAULT_ADMIN.displayName,
    passwordHash: hashPassword(password),
    roleCode: env.QTP_ADMIN_ROLE_CODE?.trim() || DEFAULT_ADMIN.roleCode,
  };
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
    for (const user of seedData.users) {
      const record = {
        username: user.username,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        roleCode: user.roleCode,
        enabled: true,
      };
      await prisma.user.upsert({
        where: { username: record.username },
        create: record,
        update: record,
      });
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
  const user = encodeURIComponent(process.env.MYSQL_USER ?? 'qtp_app');
  const password = encodeURIComponent(process.env.MYSQL_PASSWORD ?? 'qtp_dev_password');
  const database = process.env.MYSQL_DATABASE ?? 'ai_quality_platform';
  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

if (process.argv[1]?.endsWith('seed.ts')) {
  void runSeed();
}
