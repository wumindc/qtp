import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

/**
 * @author qtp
 * 单体 + SQLite 默认的 Prisma 客户端工厂。
 * 推荐由调用方显式设置 DATABASE_URL（web 在 next.config 中注入绝对路径）。
 * 未设置时回退到包内相对路径（seed 在包目录下运行可用）。
 */
const DEFAULT_URL = 'file:./prisma/dev.db';

let cached: PrismaClient | undefined;

export function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? DEFAULT_URL;
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

/** 进程级单例，供应用运行时复用。 */
export function getPrisma(): PrismaClient {
  if (!cached) {
    cached = createPrismaClient();
  }
  return cached;
}
