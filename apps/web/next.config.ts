import type { NextConfig } from 'next';

/**
 * The API base URL used by the server-side rewrite proxy. It is never exposed to the browser.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The workspace packages are compiled from source so that the RSC boundaries ("use client")
  // and the path aliases behave exactly like in the application code.
  transpilePackages: ['@teamflow/ui', '@teamflow/contracts'],
  eslint: {
    // Linting runs as a separate CI step (`npm run lint`).
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        // Proxy every API call through the Next server. This keeps the session cookie
        // first-party: the browser only ever talks to its own origin.
        source: '/api/v1/:path*',
        destination: `${API_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
