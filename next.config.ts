import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
