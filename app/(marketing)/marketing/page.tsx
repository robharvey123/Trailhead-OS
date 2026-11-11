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
  // The template appends "| Trailhead Holdings", so the brand still closes the
  // title; the front carries what the business does.
  title: 'NGP & FMCG Consulting and Bespoke Software',
  description:
    'Trailhead Holdings runs Trailhead Commercial (NGP and FMCG consulting), Trailhead Studio (bespoke software) and Trailhead Labs, its own software products.',
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
 * and get the visitor into the right track. The two cards overlap the foot of
 * the hero, so they are the first thing on the page after the statement.
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
    cta: 'Explore Trailhead Commercial',
    meta: 'SINCE 2013 · 6 MARKETS',
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
    cta: 'Explore Trailhead Studio',
    meta: 'BUILT IN-HOUSE · YOU OWN THE CODE',
  },
]

/** Facts only, each already stated elsewhere on the site. */
const heroFacts = [
  { label: 'In NGP and FMCG since', value: '2013' },
  { label: 'Markets worked', value: '6' },
  { label: 'Products we run', value: '3' },
]

/** One line each, linking straight through to each product's own site. */
const labsStrip = [
  {
    code: 'LAB-01',
    name: 'Engineer OS',
    href: 'https://engineeros.uk',
    line: 'Job management for UK field service teams, from £15 per engineer a month.',
    price: '£15 / ENGINEER / MO',
    state: 'live' as const,
  },
  {
    code: 'LAB-02',
    name: 'MVP Cricket',
    href: 'https://mvpcricket.app',
    line: 'Club management for grassroots cricket, with Play-Cricket sync and automated MVP scoring.',
    price: 'FREE · CLUB £9.99 / MO',
    state: 'live' as const,
  },
  {
    code: 'LAB-03',
    name: 'MVP Golf',
    href: 'https://mvpgolf.app',
    line: 'Golf society management with event payments, offline scoring and an Order of Merit, in early access.',
    price: 'FREE · 1% ON CARD',
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
      {/* ---- Hero ---- */}
      <section className="th-hero !pb-[clamp(9rem,16vw,12rem)]">
        <div className="bay">
          <div className="min-w-0">
            <p className="th-eyebrow rack">Trailhead Holdings Ltd</p>
            <h1 className="plan-display rack mt-6 max-w-[19ch]">
              Thirteen years selling in hard markets. Now building the software
              too.
            </h1>
            <p className="plan-lede mt-6">
              Trailhead Holdings is two businesses run by one operator.
              Commercial strategy for nicotine and FMCG brands. Bespoke software
              for companies that have outgrown their spreadsheets.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href={buildMarketingHref('/consulting', isLocalhost)}
                className="flash"
              >
                Commercial strategy
                <PlanIcon name="right" />
              </Link>
              <Link
                href={buildMarketingHref('/studio', isLocalhost)}
                className="flash-ghost"
              >
                Bespoke software
                <PlanIcon name="right" />
              </Link>
            </div>

            <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-6 border-t border-[var(--hair)] pt-7">
              {heroFacts.map((fact) => (
                <div key={fact.label}>
                  <dt className="plan-label text-[var(--ink-3)]">{fact.label}</dt>
                  <dd className="plan-figure mt-2">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---- The two doors, lifted over the foot of the hero ---- */}
      <section className="relative z-10 -mt-[clamp(6rem,11vw,8.5rem)] pb-14 md:pb-20">
        <div className="bay">
          <div className="grid gap-6 lg:grid-cols-2">
            {doors.map((door) => (
              <article
                key={door.eyebrow}
                className="group relative flex flex-col overflow-hidden rounded-[1.5rem] border border-[var(--hair)] bg-[var(--card)] p-7 shadow-[var(--shadow-lg)] transition-transform duration-300 hover:-translate-y-1 md:p-9"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--blue),var(--blue-bright))]"
                />
                <div className="flex items-baseline justify-between gap-4">
                  {/* The business name is the heading; the line below it is
                      display copy, so the homepage does not repeat the H1 of
                      the page it links to. */}
                  <h2 className="plan-label text-[var(--blue-ink)]">
                    {door.eyebrow}
                  </h2>
                  <p className="plan-data hidden text-[var(--ink-3)] sm:block">{door.meta}</p>
                </div>

                <p className="plan-h2 mt-5 max-w-[19ch] !text-[clamp(1.6rem,2.5vw,2.15rem)]">
                  {door.title}
                </p>

                <p className="plan-body mt-4 max-w-[48ch]">{door.description}</p>

                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {door.points.map((point) => (
                    <li
                      key={point}
                      className="plan-body plan-body-sm flex items-start gap-3"
                    >
                      <svg
                        aria-hidden="true"
                        width="18"
                        height="18"
                        viewBox="0 0 18 18"
                        className="mt-[3px] shrink-0"
                      >
                        <circle cx="9" cy="9" r="9" fill="var(--blue)" opacity="0.14" />
                        <path
                          d="M5.2 9.3l2.5 2.4 5-5.2"
                          fill="none"
                          stroke="var(--blue-ink)"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {point}
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <Link
                    href={buildMarketingHref(door.href, isLocalhost)}
                    className="flash"
                  >
                    {door.cta}
                    <PlanIcon name="right" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Labs: three facings, each with a real price ticket ---- */}
      <Reveal className="rail bg-[var(--plan-recess)]">
        <div className="bay py-14 md:py-20">
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
                <a
                  key={product.name}
                  href={product.href}
                  target="_blank"
                  rel="noopener noreferrer"
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
                      name="external"
                      className="float-right mt-0.5 text-[var(--flash)] transition-transform group-hover:translate-x-0.5"
                    />
                  </p>
                </a>
              ))}
            </div>

            <p className="plan-body mt-6 plan-body-sm">
              <Link
                href={buildMarketingHref('/labs', isLocalhost)}
                className="plan-label inline-flex items-center gap-2 text-[var(--ink-2)] transition-colors hover:text-[var(--flash)]"
              >
                All three, side by side
                <PlanIcon name="right" size={13} />
              </Link>
            </p>
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
