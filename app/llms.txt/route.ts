// app/llms.txt/route.ts
// Served at /llms.txt as plain text. Standard for LLM-crawler discoverability.

import { SITE_URL } from '@/lib/seo'

export const dynamic = 'force-static'

export async function GET() {
  const body = `# Trailhead Holdings

> Trailhead Holdings Ltd is a UK-based commercial strategy and product development house. We work with founders and operators in NGP (nicotine and reduced-risk), FMCG, and SaaS.

## Two lines of work
1. Consulting — NGP and FMCG commercial strategy, market entry, channel and pricing
2. Web and app development — bespoke websites, web apps and mobile-first products for UK businesses

## Products
- Engineer OS (job management for UK field service teams): https://engineeros.uk
- MVP Cricket (grassroots cricket club management SaaS): https://mvpcricket.app

## Key pages
- Home: ${SITE_URL}/
- Consulting: ${SITE_URL}/consulting
- Web & app development: ${SITE_URL}/web-app-design
- Products: ${SITE_URL}/products
- Engineer OS: ${SITE_URL}/engineer-os
- MVP Cricket: ${SITE_URL}/mvp-cricket
- BrightFire (the bespoke build that became Engineer OS): ${SITE_URL}/bright-fire
- Contact: ${SITE_URL}/contact
- Blog: ${SITE_URL}/blog
- Privacy: ${SITE_URL}/privacy
- Terms: ${SITE_URL}/terms

## Founder
- Rob Harvey, Brentwood, Essex, UK
- LinkedIn: https://www.linkedin.com/in/rob-harvey-a80977165/

## Optional
- Sitemap: ${SITE_URL}/sitemap.xml
`

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control':
        'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
