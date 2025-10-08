import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.axcdn.top',
      },    
      {
        protocol: 'https',
        hostname: 'i0.wp.com',
      },  
      {
        protocol: 'https',
        hostname: 'i1.wp.com',
      },
      {
        protocol: 'https',
        hostname: 'i2.wp.com',
      }, 
      {
        protocol: 'https',
        hostname: 'i3.wp.com',
      },
      {
        protocol: 'https',
        hostname: 'vcover-vt-pic.wetvinfo.com',
      },
      {
        protocol: 'https',
        hostname: '*.wp.com',
      },  
      {
        protocol: 'https',
        hostname: 'kissasian.dk',
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
        hostname: 'kissasian.mba',
      },
      {
        protocol: 'https',
        hostname: 'kdrama-one.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'wiki.d-addicts.com',
      },
      {
        protocol: 'https',
        hostname: 'images.asianctv.co',
      },
      // Common drama image hosting domains
      {
        protocol: 'https',
        hostname: '*.mydramalist.com',
      },
      {
        protocol: 'https',
        hostname: '*.viki.io',
      },
      {
        protocol: 'https',
        hostname: '*.dramacool.com',
      },
      {
        protocol: 'https',
        hostname: '*.dramanice.com',
      },
      {
        protocol: 'https',
        hostname: '*.kissasian.*',
      },
      {
        protocol: 'https',
        hostname: '*.asianload.io',
      },
      {
        protocol: 'https',
        hostname: '*.gdrive.*',
      },
      {
        protocol: 'https',
        hostname: '*.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '*.imgur.com',
      },
      {
        protocol: 'https',
        hostname: '*.imagekit.io',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.netlify.app',
      },
      {
        protocol: 'https',
        hostname: '*.vercel.app',
      },
      {
        protocol: 'https',
        hostname: '*.github.io',
      },
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'https://i.axcdn.top',
      },
      // Catch-all for HTTPS images (use with caution)
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 3600, // Cache for 1 hour
    deviceSizes: [640, 768, 1024, 1280, 1600],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 90, 100], // Configure allowed quality values
    // Fallback for unoptimized images
    unoptimized: false,
  }
};

export default nextConfig;