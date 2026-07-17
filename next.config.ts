import type { NextConfig } from "next";

// Bundle analyzer integration: enable by setting ANALYZE=true in the environment
// when running the build (e.g. `ANALYZE=true npm run build`).
// Uses @next/bundle-analyzer to emit a client bundle report.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  // Production-ready configuration for Conferly

  // Security and cache headers
  async headers() {
    return [
      // ── Cache strategy for STATIC routes (marketing, informational pages) ──
      {
        source: '/((?:admin/health|auth(?:/forgot-password|/update-password)?|class(?:/pricing)?|pricing|robots\\.txt|sitemap\\.xml))',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=31536000',
          },
        ],
      },
      // ── Primary: served for ALL hosts (conferly.site, preview deployments, etc.) ──
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          // Canonical URL — always points to the apex domain
          {
            key: 'Link',
            value: '<https://conferly.site$1>; rel="canonical"',
          },
          // Content Security Policy — strict but functional with All-Hands and monitoring
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' app.all-hands.dev; script-src 'self' 'unsafe-inline' 'unsafe-eval' va.vercel-scripts.com static.cloudflareinsights.com app.all-hands.dev https://www.googletagmanager.com https://www.google-analytics.com; connect-src 'self' app.all-hands.dev https://www.google-analytics.com wss://*.livekit.cloud wss://*.livekit.com https://huggingface.co https://router.huggingface.co https://*.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: app.all-hands.dev; font-src 'self'; frame-ancestors 'self' app.all-hands.dev; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },

  // Optimize package imports
  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js', '@tiptap/react', '@tiptap/starter-kit'],
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