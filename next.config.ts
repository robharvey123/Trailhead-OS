import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['node-ical'],
  async headers() {
    // Client proposal links carry a bearer token in the path: never leak it in
    // a Referer header, and never let a shared cache keep the page or its PDF.
    const proposalHeaders = [
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ]
    return [
      { source: '/proposal/:path*', headers: proposalHeaders },
      { source: '/api/proposal/:path*', headers: proposalHeaders },
    ]
  },
  async redirects() {
    return [
      {
        source: '/workspaces',
        destination: '/analytics',
        permanent: true,
      },
      {
        source: '/workspace/:id',
        destination: '/analytics/:id',
        permanent: true,
      },
      {
        source: '/workspace/:id/dashboard',
        destination: '/analytics/:id',
        permanent: true,
      },
      {
        source: '/workspace/:id/imports',
        destination: '/analytics/:id/imports',
        permanent: true,
      },
      {
        source: '/workspace/:id/settings',
        destination: '/analytics/:id/settings',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
