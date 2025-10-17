import type { NextConfig } from "next";

const LOCALTUNNEL_SUBDOMAIN = "mynextapp"; // твой subdomain

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '0.0.0.0',
        port: '8003',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'taam.menu',
        port: '8003',
        pathname: '/**',
      },
    ],
  },

  experimental: {
    allowedDevOrigins: [
      'http://localhost:3000',
      `https://${LOCALTUNNEL_SUBDOMAIN}.loca.lt`,
    ],
  } as any, // TypeScript "не парься"

  devIndicators: {
    buildActivity: false, // убирает зелёный индикатор Next.js в dev
  },
}

module.exports = nextConfig;
