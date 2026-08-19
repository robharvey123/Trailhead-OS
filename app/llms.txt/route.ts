// app/llms.txt/route.ts
// Served at /llms.txt as plain text. Standard for LLM-crawler discoverability.

import { SITE_URL } from '@/lib/seo'

export const dynamic = 'force-static'

export async function GET() {
  const body = `# Trailhead Holdings

> Trailhead Holdings Ltd is the UK parent of three tracks run by one operator, Rob Harvey: Trailhead Commercial (NGP and FMCG consulting), Trailhead Studio (bespoke software), and Trailhead Labs (its own SaaS products). Commercial and Studio are separate specialist businesses with separate buyers, not one blended agency.

## Trailhead Commercial: consulting
NGP and FMCG commercial strategy: market entry (UK, EU, DACH, Sweden), distributor and channel strategy, pricing architecture, interim commercial leadership. Thirteen years operating in nicotine and reduced-risk, six markets, one founder exit.
- ${SITE_URL}/consulting

## Trailhead Studio: bespoke software
Internal tools, client portals, offline-capable field apps, marketing sites and full web app builds for UK businesses. Built in-house by the person who scoped them.
- ${SITE_URL}/studio

## Trailhead Labs: products
- Engineer OS (job management for UK field service teams, from £15 per engineer/month): https://engineeros.uk
- MVP Cricket (grassroots cricket club management SaaS, from £19/month): https://mvpcricket.app
- MVP Predictor (white-label football prediction competitions for clubs, in build): ${SITE_URL}/labs/mvp-predictor
- Portfolio: ${SITE_URL}/labs

## Other pages
- Home: ${SITE_URL}/
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
