import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Reveal from '@/components/marketing/Reveal'
import { formatBlogDate } from '@/lib/blog'
import { getPublishedBlogPosts } from '@/lib/db/blog-posts'
import { createClient } from '@/lib/supabase/server'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Trailhead Holdings: Commercial Strategy & Software',
  description:
    'Trailhead Holdings runs two businesses: Trailhead Commercial for NGP and FMCG consulting, and Trailhead Studio for bespoke software, plus the Trailhead Labs product portfolio.',
  path: '/',
  // Brand terms only. The consulting and software keyword pools belong to
  // /consulting and /studio. The homepage competing for both diluted all three.
  keywords: [
    'Trailhead Holdings',
    'Trailhead Commercial',
    'Trailhead Studio',
    'Trailhead Labs',
    'Rob Harvey',
  ],
})

/**
 * The two doors. Consulting and software builds are separate businesses with
 * separate buyers, so the homepage's only job is to establish who Trailhead is
 * and get the visitor into the right track. Each door wears its track's accent
 * so the colour coding starts here.
 */
const doors = [
  {
    eyebrow: 'Trailhead Commercial',
    title: 'You have a brand. It needs to sell somewhere it isn’t selling yet.',
    description:
      'Commercial strategy for nicotine, reduced-risk and FMCG brands, from someone who has spent thirteen years doing it rather than reading about it.',
    points: [
      'Market entry across the UK, EU, DACH and Sweden',
      'Distributor identification, negotiation and channel strategy',
      'Pricing architecture and portfolio rationalisation',
      'Interim commercial leadership while you hire',
    ],
    href: '/consulting',
    cta: 'Enter Trailhead Commercial',
    accent: '#0B4A6F',
    accentStrong: '#083A57',
  },
  {
    eyebrow: 'Trailhead Studio',
    title: 'You are running the business on spreadsheets, WhatsApp and someone’s memory.',
    description:
      'Bespoke software for companies that have outgrown their tooling, built and maintained by the person who scoped it.',
    points: [
      'Internal tools, client portals and operational dashboards',
      'Offline-capable field apps for teams working without signal',
      'Full product builds taken from idea through to billing customers',
      'Rebuilds of ageing sites for speed, search and maintainability',
    ],
    href: '/studio',
    cta: 'Enter Trailhead Studio',
    accent: '#0EA5E9',
    accentStrong: '#0284C7',
  },
]

/** One line each. The full story lives on each product's own site, via /labs. */
const labsStrip = [
  {
    name: 'Engineer OS',
    line: 'Job management for UK field service teams, from £15 per engineer a month.',
  },
  {
    name: 'MVP Cricket',
    line: 'Club management for grassroots cricket, with Play-Cricket sync and automated MVP scoring.',
  },
  {
    name: 'MVP Predictor',
    line: 'White-label football prediction competitions for clubs, in build.',
  },
]

export default async function MarketingHomePage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const supabase = await createClient()
  const posts = await getPublishedBlogPosts({ limit: 3 }, supabase).catch(
    () => []
  )

  return (
    <div>
      <section className="px-6 pb-14 pt-14 md:px-8 md:pb-16 md:pt-20">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-500">
            Trailhead Holdings Ltd
          </p>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-[1.08] tracking-[-0.05em] text-[var(--marketing-text)] md:text-[56px]">
            Thirteen years selling in hard markets. Now building the software
            too.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
            Trailhead Holdings is two businesses run by one operator.
            Commercial strategy for nicotine and FMCG brands. Bespoke software
            for companies that have outgrown their spreadsheets.
          </p>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            One operator. Two businesses. Since 2014.
          </p>
        </div>
      </section>

      {/* The doors are the CTA. No button competes with them above. */}
      <section className="px-6 pb-20 md:px-8 md:pb-24">
        <div className="mx-auto grid max-w-[1100px] gap-6 lg:grid-cols-2">
          {doors.map((door) => (
            <article
              key={door.eyebrow}
              style={
                {
                  '--door-accent': door.accent,
                  '--door-accent-strong': door.accentStrong,
                } as CSSProperties
              }
              className="flex flex-col rounded-[2rem] border border-[var(--marketing-border)] bg-white p-8 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)] md:p-10"
            >
              {/* Inset accent bar instead of a card border. A straight
                  border-top clashes with the 2rem corner radius. */}
              <span
                aria-hidden="true"
                className="h-1 w-12 rounded-full bg-[var(--door-accent)]"
              />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--door-accent)]">
                {door.eyebrow}
              </p>
              <h2 className="mt-4 text-2xl font-bold leading-snug tracking-[-0.03em] md:text-3xl">
                {door.title}
              </h2>
              <p className="mt-4 leading-8 text-slate-600">{door.description}</p>

              <ul className="mt-6 flex-1 space-y-2.5 text-[0.98rem] text-slate-600">
                {door.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--door-accent)]"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 pt-2">
                <Link
                  href={buildMarketingHref(door.href, isLocalhost)}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--door-accent)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--door-accent-strong)]"
                >
                  {door.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Reveal className="bg-[var(--marketing-surface)] px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7C3AED]">
            Trailhead Labs
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-[-0.03em] md:text-4xl">
            And three products we run.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {labsStrip.map((product) => (
              <Link
                key={product.name}
                href={buildMarketingHref('/labs', isLocalhost)}
                className="group rounded-[2rem] border border-[var(--marketing-border)] bg-white p-7 transition hover:border-[#C4B5FD]"
              >
                <h3 className="text-xl font-bold tracking-[-0.02em]">
                  {product.name}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">{product.line}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#7C3AED]">
                  Trailhead Labs
                  <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                    &rarr;
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal id="blog" className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
                Thinking
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] md:text-4xl">
                From the blog
              </h2>
            </div>
            <Link
              href={buildMarketingHref('/blog', isLocalhost)}
              className="text-sm font-semibold text-slate-600 transition hover:text-[var(--marketing-text)]"
            >
              All posts →
            </Link>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-8 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]"
              >
                <p className="text-sm text-slate-500">
                  {formatBlogDate(post.published_at)}
                </p>
                <h3 className="mt-4 text-2xl font-bold tracking-[-0.03em]">
                  {post.title}
                </h3>
                <p className="mt-4 text-[0.98rem] leading-8 text-slate-600">
                  {post.excerpt}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={buildMarketingHref(`/blog/${post.slug}`, isLocalhost)}
                  className="mt-6 inline-flex text-sm font-semibold text-slate-700 transition hover:text-[var(--marketing-text)]"
                >
                  Read more →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  )
}
