import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';

/**
 * @author qtp
 * 单体 + SQLite：未显式配置 DATABASE_URL 时，注入指向 shared-database 包内
 * dev.db 的绝对路径（next 进程 cwd = apps/web，故向上两级到 packages）。
 */
if (!process.env.DATABASE_URL) {
  const dbPath = resolve(process.cwd(), '../../packages/shared-database/prisma/dev.db');
  process.env.DATABASE_URL = `file:${dbPath}`;
}

/**
 * @author codex
 * Allows Next dev client resources from localhost and current LAN IPv4 hosts.
 */
function getAllowedDevOrigins() {
  const hosts = new Set(['127.0.0.1', 'localhost']);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        hosts.add(address.address);
      }
    }
  }
  return Array.from(hosts);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  reactStrictMode: true,
  // 单体：Server Component 直读 SQLite，需把原生/Prisma 包外部化避免打包
  serverExternalPackages: ['better-sqlite3', '@prisma/client', '@prisma/adapter-better-sqlite3'],
  // 工作区 TS 包直接消费源码
  transpilePackages: [
    '@ai-quality-platform/shared-database',
    '@ai-quality-platform/shared-config',
    '@ai-quality-platform/shared-auth',
  ],
};

export default nextConfig;
