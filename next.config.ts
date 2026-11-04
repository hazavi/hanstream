import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.BACKEND_STANDALONE === '1' ? 'standalone' : undefined,
  // Keep the running development server from overwriting production build output.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  // Enable React compiler for better performance
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },

  // Performance optimizations
  experimental: {
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
