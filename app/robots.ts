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
        // Only API routes are blocked. /_next/ must stay crawlable: it serves
        // the CSS and JS Google needs to render the pages. /report/ and
        // /discovery are kept out of the index with a noindex tag on the page
        // instead, which a crawler can only see if robots.txt lets it in.
        // (The Host directive is Yandex-only and Google ignores it.)
        disallow: ['/api/', '/admin'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
