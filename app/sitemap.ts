// app/sitemap.ts
// Served at /sitemap.xml automatically. Add new static routes to STATIC_ROUTES.

import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'
import { getPublishedBlogPosts } from '@/lib/db/blog-posts'

const STATIC_ROUTES: {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/consulting', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/studio', changeFrequency: 'monthly', priority: 0.9 },
  // Retired paths (/web-app-design, /products, /engineer-os, /mvp-cricket,
  // /bright-fire) 301 in middleware.ts and must NOT be listed here. A
  // sitemap advertising redirects is a crawl-budget leak.
  { path: '/labs', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/labs/mvp-predictor', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.6 },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.9 },
  // These are real, indexable routes and were missing from the sitemap.
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  let postEntries: MetadataRoute.Sitemap = []
  try {
    const posts = await getPublishedBlogPosts()
    postEntries = posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.updated_at ?? p.published_at ?? now),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  } catch {
    // Non-fatal: sitemap still works without blog posts
  }

  return [...staticEntries, ...postEntries]
}
