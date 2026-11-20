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
    // Retired modules (Nov 2026 cut): the brand analytics workspace, internal
    // messages and deals. Old bookmarks land on the dashboard. Not permanent, so
    // a path can be reused later without fighting browser caches.
    return [
      { source: '/workspaces', destination: '/dashboard', permanent: false },
      { source: '/workspace/:path*', destination: '/dashboard', permanent: false },
      { source: '/analytics', destination: '/dashboard', permanent: false },
      { source: '/analytics/:path*', destination: '/dashboard', permanent: false },
      { source: '/messages', destination: '/dashboard', permanent: false },
      { source: '/messages/:path*', destination: '/dashboard', permanent: false },
      { source: '/deals', destination: '/crm/accounts', permanent: false },
      { source: '/growth/:siteId/:section(articles|briefs|clusters|gap|keywords|links|pages|paid|prompts)/:path*', destination: '/growth/:siteId', permanent: false },
    ];
  },
};

export default nextConfig;
