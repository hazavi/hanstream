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
    ]
  }
};

export default nextConfig;
