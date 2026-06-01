import { defineConfig } from 'prisma/config';

/**
 * @author qtp
 * 单体 + SQLite 默认：零配置本地启动，DATABASE_URL 未设置时落到本地文件。
 * 切 MySQL：设置 DATABASE_URL 并把 schema.prisma 的 provider 改为 "mysql"。
 */
const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
  datasource: { url },
});
