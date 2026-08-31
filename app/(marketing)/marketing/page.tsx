import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import PlanIcon from '@/components/marketing/PlanIcon'
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
 * and get the visitor into the right track.
 *
 * Under the bay plan each door is a brand block: a full facing of one keyed
 * colour standing hard against its neighbour, exactly as two brands sit
 * adjacent in a bay. The price flash never prints on the block itself — it
 * prints on the white shelf-edge ticket at its foot, which is both where it
 * belongs physically and the only place red stays legible against yellow.
 */
const doors = [
  {
    code: 'SEL-01',
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
    meta: 'SINCE 2014 · 6 MARKETS',
    key: 'var(--key-com)',
    keyInk: '#ffffff',
  },
  {
    code: 'SEL-02',
    eyebrow: 'Trailhead Studio',
    title:
      'You are running the business on spreadsheets, WhatsApp and someone’s memory.',
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
    meta: 'BUILT IN-HOUSE · YOU OWN THE CODE',
    key: 'var(--key-studio)',
    keyInk: 'var(--ink)',
  },
]

/** One line each. The full story lives on each product's own site, via /labs. */
const labsStrip = [
  {
    code: 'LAB-01',
    name: 'Engineer OS',
    line: 'Job management for UK field service teams, from £15 per engineer a month.',
    price: '£15 / ENGINEER / MO',
    state: 'live' as const,
  },
  {
    code: 'LAB-02',
    name: 'MVP Cricket',
    line: 'Club management for grassroots cricket, with Play-Cricket sync and automated MVP scoring.',
    price: '£19 / CLUB / MO',
    state: 'live' as const,
  },
  {
    code: 'LAB-03',
    name: 'MVP Predictor',
    line: 'White-label football prediction competitions for clubs, in build.',
    price: 'PRICE NOT SET',
    state: 'build' as const,
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
      {/* ---- Hero: the plan's title block, hung from the header rail ---- */}
      <section className="pt-7 pb-12 md:pt-8 md:pb-14">
        <div className="bay">
          {/* The title block sits in the gutter beside the statement on
              desktop and below it on a phone, so it never reads as a caption
              stacked above the heading. */}
          <div className="bay-code order-2 hidden lg:order-1 lg:block">
            <div className="ticket">
              <p className="plan-label text-[var(--ink)]">Trailhead</p>
              <p className="plan-label mt-1 text-[var(--ink-3)]">Holdings Ltd</p>
              <div className="ticket-rule">
                <p className="plan-data text-[var(--ink-2)]">EST. 2014</p>
                <p className="plan-data mt-1 text-[var(--ink-2)]">
                  BRENTWOOD
                  <br />
                  ESSEX
                </p>
              </div>
            </div>
          </div>

          <div className="order-1 min-w-0 lg:order-2">
            <h1 className="plan-display rack max-w-[19ch]">
              Thirteen years selling in hard markets. Now building the software
              too.
            </h1>
            <p className="plan-lede mt-5">
              Trailhead Holdings is two businesses run by one operator.
              Commercial strategy for nicotine and FMCG brands. Bespoke software
              for companies that have outgrown their spreadsheets.
            </p>

            <p className="plan-note mt-5 text-[var(--ink-2)]">
              One operator · Two businesses · Since 2014
            </p>
          </div>
        </div>
      </section>

      {/* ---- The two doors, standing as brand blocks in one bay ---- */}
      <section className="rail">
        <div className="grid lg:grid-cols-2">
          {doors.map((door) => (
            <article
              key={door.eyebrow}
              className="brand-block flex flex-col border-b border-[var(--ink)] p-6 pt-7 md:p-8 md:pt-9 lg:border-b-0 lg:[&+&]:border-l lg:[&+&]:border-[var(--ink)]"
              style={
                {
                  '--key': door.key,
                  '--key-ink': door.keyInk,
                } as React.CSSProperties
              }
            >
              <div className="flex items-baseline justify-between gap-4">
                <p
                  className="plan-label"
                  style={{ color: 'var(--key-ink)' }}
                >
                  {door.eyebrow}
                </p>
                <p
                  className="plan-data opacity-70"
                  style={{ color: 'var(--key-ink)' }}
                >
                  {door.code}
                </p>
              </div>

              <h2
                className="plan-h2 mt-4 max-w-[18ch]"
                style={{ color: 'var(--key-ink)' }}
              >
                {door.title}
              </h2>

              <p className="plan-body mt-4 max-w-[46ch]">{door.description}</p>

              {/* The spec list, ruled the way a facing's contents are listed. */}
              <ul className="mt-6 flex-1">
                {door.points.map((point) => (
                  <li
                    key={point}
                    className="border-t py-2.5 plan-body-sm leading-snug"
                    style={{
                      borderColor:
                        'color-mix(in srgb, var(--key-ink) 26%, transparent)',
                      color:
                        'color-mix(in srgb, var(--key-ink) 88%, var(--key))',
                    }}
                  >
                    {point}
                  </li>
                ))}
              </ul>

              {/* The shelf-edge ticket: white card, the price flash printed on
                  it rather than on the block. */}
              <div className="ticket mt-7">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="plan-data text-[var(--ink-3)]">{door.code}</p>
                  <p className="plan-data text-[var(--ink-3)]">{door.meta}</p>
                </div>
                <div className="ticket-rule">
                  <Link
                    href={buildMarketingHref(door.href, isLocalhost)}
                    className="flash"
                  >
                    {door.cta}
                    <PlanIcon name="right" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---- Labs: three facings, each with a real price ticket ---- */}
      <Reveal className="rail bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">BAY 03</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Labs</p>
          </div>

          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">And three products we run.</h2>
            <p className="plan-body mt-4">
              Live products with paying customers, which means we carry the
              support, the billing and the uptime.
            </p>

            <div className="facings mt-8 sm:grid-cols-3">
              {labsStrip.map((product) => (
                <Link
                  key={product.name}
                  href={buildMarketingHref('/labs', isLocalhost)}
                  className="facing group flex flex-col bg-[var(--plan)] transition-colors hover:bg-[var(--card)]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="plan-data text-[var(--ink-3)]">
                      {product.code}
                    </span>
                    <span
                      className={`key-state ${
                        product.state === 'live' ? 'key-live' : 'key-build'
                      }`}
                    >
                      {product.state === 'live' ? 'Live' : 'In build'}
                    </span>
                  </div>

                  <h3 className="plan-h3 mt-4">{product.name}</h3>
                  <p className="plan-body mt-2.5 flex-1 plan-body-sm">
                    {product.line}
                  </p>

                  <p className="plan-data mt-6 border-t border-[var(--hair)] pt-3 text-[var(--ink)]">
                    {product.price}
                    <PlanIcon
                      name="right"
                      className="float-right mt-0.5 text-[var(--flash)] transition-transform group-hover:translate-x-0.5"
                    />
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- Notes: the plan's annotation sheet ---- */}
      <Reveal id="blog" className="rail">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">BAY 04</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Notes</p>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="plan-h2 rack-target">From the blog</h2>
              <Link
                href={buildMarketingHref('/blog', isLocalhost)}
                className="plan-label inline-flex items-center gap-2 text-[var(--ink-2)] transition-colors hover:text-[var(--flash)]"
              >
                All posts
                <PlanIcon name="right" size={13} />
              </Link>
            </div>

            <div className="mt-8 border-t border-[var(--ink)]">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={buildMarketingHref(`/blog/${post.slug}`, isLocalhost)}
                  className="group grid gap-x-8 gap-y-2 border-b border-[var(--hair)] py-5 transition-colors hover:bg-[var(--card)] md:grid-cols-[9rem_minmax(0,1fr)_auto] md:items-baseline"
                >
                  <span className="plan-data text-[var(--ink-3)]">
                    {formatBlogDate(post.published_at)}
                  </span>
                  <span className="min-w-0">
                    <span className="plan-h3 block">{post.title}</span>
                    <span className="plan-body mt-2 block plan-body-sm">
                      {post.excerpt}
                    </span>
                  </span>
                  <span className="plan-data inline-flex items-center gap-3 whitespace-nowrap text-[var(--ink-3)]">
                    {post.tags.join(' · ').toUpperCase()}
                    <PlanIcon
                      name="right"
                      size={13}
                      className="text-[var(--flash)] transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              ))}

              {posts.length === 0 ? (
                <p className="plan-body border-b border-[var(--hair)] py-6">
                  No posts published yet.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
