import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';

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
};

export default nextConfig;
