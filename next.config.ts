import type { NextConfig } from "next";
import { securityHeaders } from './lib/security-policy.mjs';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // These Node-only dependencies should not rely on generated Webpack vendor chunks.
  serverExternalPackages: ['cheerio', 'undici'],
  async headers() { return [{ source: '/:path*', headers: securityHeaders(process.env.NODE_ENV === 'development') }]; },
  output: process.env.BACKEND_STANDALONE === '1' ? 'standalone' : undefined,
  // Keep the running development server from overwriting production build output.
  distDir: process.env.NODE_ENV === 'development' ? (process.env.TURBOPACK ? '.next-dev-turbo' : '.next-dev-webpack') : '.next',
  // Remove debug logging from production bundles while retaining errors.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },

  // Performance optimizations
  experimental: {
    // HTML readers already coalesce and cache requests, including timeout recovery.
    serverComponentsHmrCache: false,
    optimizePackageImports: ['@/components', '@/lib'],
    webpackMemoryOptimizations: true,
  },

  // Optimize JavaScript bundles
  modularizeImports: {
    '@/components': {
      transform: '@/components/{{member}}',
    },
  },

  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
};

export default nextConfig;
