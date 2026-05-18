import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so Next doesn't pick up unrelated lockfiles
  // elsewhere on disk (e.g. ~/package-lock.json).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
