// app/robots.ts
// Next.js App Router serves this at /robots.txt automatically.

import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /report/ serves tokenised client reports and /discovery is a private
        // intake form — neither should ever be indexed, even if a URL leaks.
        disallow: ['/api/', '/_next/', '/admin', '/report/', '/discovery'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
