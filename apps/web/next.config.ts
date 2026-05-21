import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @author codex: The in-app browser opens 127.0.0.1, so allow Next dev resources from that host.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  reactStrictMode: true,
};

export default nextConfig;
