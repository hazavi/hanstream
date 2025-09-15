import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.axcdn.top',
      },      
      {
        protocol: 'https',
        hostname: 'i.mydramalist.com',
      },      
      {
        protocol: 'https',
        hostname: 'images.asianctv.co',
      },
      {
        protocol: 'https',
        hostname: 'kdrama-one.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'wiki.d-addicts.com',
      }
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 3600, // Cache for 1 hour
    deviceSizes: [640, 768, 1024, 1280, 1600],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  }
};

export default nextConfig;