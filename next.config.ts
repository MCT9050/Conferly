import type { NextConfig } from "next";

// Bundle analyzer integration: enable by setting ANALYZE=true in the environment
// when running the build (e.g. `ANALYZE=true npm run build`).
// Uses @next/bundle-analyzer to emit a client bundle report.
// Require is used to keep this file compatible with the existing TS setup.
const withBundleAnalyzer = require('@next/bundle-analyzer')({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  // Production-ready configuration for Conferly
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(), interest-cohort=()'
          }
        ]
      }
    ];
  },

  // Content Security Policy (basic version - enhance with nonce for production)
  // Note: For full CSP with nonces, use next-safe-csp or similar library
  experimental: {
    // Enable when ready for production CSP
    // cpus: 1, // Limit CPU usage for edge compatibility
  },

  // Optimize images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Compression
  compress: true,

  // Powered by header removal for security
  poweredByHeader: false,

  // Logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // Turbopack configuration for Next.js 16
  // Turbopack is now the default build system
  turbopack: {
    // Turbopack optimizations are handled automatically
    // Override with custom settings if needed
  },

  // Webpack optimizations for production (fallback if not using Turbopack)
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Production client optimizations
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
            },
          },
        },
      };
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
