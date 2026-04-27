// app/llms.txt/route.ts
// Served at /llms.txt as plain text. Standard for LLM-crawler discoverability.

import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export async function GET() {
  const body = `# Trailhead Holdings

> Trailhead Holdings Ltd is a UK-based commercial strategy and product development house. We work with founders and operators in NGP (nicotine and reduced-risk), FMCG, and SaaS.

## Services
- NGP and FMCG commercial strategy, market entry, channel and pricing
- Bespoke software and SaaS product development
- In-house ventures including MVP Cricket and BrightFire

## Key pages
- Home: ${SITE_URL}/
- BrightFire (field service software example): ${SITE_URL}/bright-fire
- Contact: ${SITE_URL}/contact
- Blog: ${SITE_URL}/blog

## Founder
- Rob Harvey, Brentwood, Essex, UK
- LinkedIn: https://www.linkedin.com/in/rob-harvey-a80977165/

## Optional
- Sitemap: ${SITE_URL}/sitemap.xml
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
