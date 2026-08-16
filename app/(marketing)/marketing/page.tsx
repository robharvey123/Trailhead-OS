import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import ContactDetailsCard from '@/components/marketing/ContactDetailsCard'
import ContactForm from '@/components/marketing/ContactForm'
import Reveal from '@/components/marketing/Reveal'
import { formatBlogDate } from '@/lib/blog'
import { getPublishedBlogPosts } from '@/lib/db/blog-posts'
import { createClient } from '@/lib/supabase/server'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Commercial Strategy & Product Development for NGP, FMCG and SaaS',
  description:
    'We help brands grow in competitive markets, from NGP and FMCG consulting to bespoke software and SaaS products. UK-based, founder-led.',
  path: '/',
  keywords: [
    'NGP consulting',
    'nicotine pouch consulting',
    'FMCG go to market',
    'bespoke software development UK',
    'commercial strategy consultant',
  ],
})

/**
 * The homepage's two tracks. Consulting and software builds are separate
 * businesses with separate buyers, so the page asks the visitor to pick one
 * rather than presenting four capabilities at equal weight.
 */
const tracks = [
  {
    eyebrow: 'Line one',
    title: 'Consulting',
    description:
      'NGP and FMCG commercial strategy from someone who has actually run these businesses — thirteen years in the category, six markets, and an exit.',
    points: [
      'Market entry across the UK, EU, DACH and Sweden',
      'Distributor identification, negotiation and channel strategy',
      'Pricing architecture and portfolio rationalisation',
      'Interim commercial leadership while you hire',
    ],
    href: '/consulting',
    cta: 'See the track record',
    secondaryHref: '/contact',
    secondaryCta: 'Start a conversation',
  },
  {
    eyebrow: 'Line two',
    title: 'Web & app development',
    description:
      'Bespoke websites, web apps and mobile-first products for UK businesses that have outgrown the off-the-shelf tools — built and maintained by the same person who scoped them.',
    points: [
      'Internal tools, client portals and operational dashboards',
      'Offline-capable field apps for teams working without signal',
      'Full product builds taken from idea through to billing customers',
      'Rebuilds of ageing sites for speed, search and maintainability',
    ],
    href: '/web-app-design',
    cta: 'See the work',
    secondaryHref: '/products',
    secondaryCta: 'See the products',
  },
]

const productStrip = [
  {
    name: 'Engineer OS',
    sector: 'Field service',
    summary:
      'Job management for UK field service teams. Offline job sheets, automatic certificates and asset history, from £15 per engineer a month.',
    href: '/engineer-os',
    cta: 'How it works',
  },
  {
    name: 'MVP Cricket',
    sector: 'Sports SaaS',
    summary:
      'Multi-tenant club management for grassroots cricket. Play-Cricket sync, automated MVP scoring and member notifications.',
    href: '/mvp-cricket',
    cta: 'How it works',
  },
  {
    name: 'BrightFire',
    sector: 'Fire & security',
    summary:
      'The bespoke build that became Engineer OS, made for a fire and security contractor in Harlow and productised once it proved itself.',
    href: '/bright-fire',
    cta: 'Read the story',
  },
]

const stats = [
  ['13+', 'Years in NGP & FMCG'],
  ['6', 'International markets operated in'],
  ['£5M+', 'Revenue built from scratch'],
  ['1', 'Successful founder exit'],
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
      <section className="px-6 pb-18 pt-10 md:px-8 md:pb-24">
        <div className="mx-auto grid min-h-[calc(100vh-7rem)] max-w-[1100px] items-center gap-14 lg:grid-cols-[1.25fr_0.85fr]">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-500">
              Trailhead Holdings Ltd
            </p>
            <h1 className="mt-6 text-5xl font-bold leading-[1.08] tracking-[-0.05em] text-[var(--marketing-text)] md:text-[56px]">
              <span className="block">Commercial strategy.</span>
              <span className="block">Digital products.</span>
              <span className="block">Built to last.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 md:text-xl">
              We help brands grow in competitive markets, from NGP and FMCG
              consulting to bespoke software development and SaaS products.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href={buildMarketingHref('/#contact', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-600"
              >
                Work with us
              </Link>
              <Link
                href="#services"
                className="inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] px-6 py-3.5 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
              >
                See what we build
              </Link>
            </div>
          </div>

          <div className="relative mx-auto h-[420px] w-full max-w-[420px]">
            <div className="absolute inset-0 rounded-[2.5rem] border border-sky-100 bg-[linear-gradient(160deg,rgba(14,165,233,0.08),rgba(255,255,255,0.92))]" />
            <div className="absolute left-[8%] top-[14%] h-44 w-36 rounded-[2rem] bg-sky-500/14 shadow-[0_30px_60px_-35px_rgba(14,165,233,0.7)]" />
            <div className="absolute right-[10%] top-[10%] h-36 w-44 rounded-[1.75rem] border border-sky-200 bg-sky-500/12" />
            <div className="absolute left-[18%] top-[40%] h-40 w-56 rounded-[2rem] bg-sky-500/18" />
            <div className="absolute bottom-[12%] right-[12%] h-48 w-40 rounded-[2.25rem] border border-sky-100 bg-sky-500/10" />
            <div className="absolute bottom-[18%] left-[12%] h-20 w-20 rounded-[1.5rem] bg-sky-400/20" />
          </div>
        </div>
      </section>

      <Reveal
        id="services"
        className="scroll-mt-24 bg-[var(--marketing-surface)] px-6 py-20 md:px-8 md:py-24"
      >
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
            What we do
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-[-0.03em] md:text-4xl">
            Two lines of work, run by the same operator.
          </h2>
          <p className="mt-4 max-w-2xl leading-8 text-slate-600">
            Most people arriving here need one or the other, so they are kept
            apart rather than blended into a single list of capabilities.
          </p>

          {/* Two tracks at equal weight — a visitor self-selects once, here,
              instead of choosing between four undifferentiated cards. */}
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {tracks.map((track) => (
              <article
                key={track.title}
                className="flex flex-col rounded-[2rem] border border-[var(--marketing-border)] bg-white p-8 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)] md:p-10"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {track.eyebrow}
                </p>
                <h3 className="mt-4 text-3xl font-bold tracking-[-0.03em]">{track.title}</h3>
                <p className="mt-4 leading-8 text-slate-600">{track.description}</p>

                <ul className="mt-6 space-y-2.5 text-[0.98rem] text-slate-600">
                  {track.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-700" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-col gap-3 pt-2 sm:flex-row">
                  <Link
                    href={buildMarketingHref(track.href, isLocalhost)}
                    className="inline-flex items-center justify-center rounded-full bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800"
                  >
                    {track.cta}
                  </Link>
                  {track.secondaryHref ? (
                    <Link
                      href={buildMarketingHref(track.secondaryHref, isLocalhost)}
                      className="inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] px-5 py-3 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
                    >
                      {track.secondaryCta}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
            Track record
          </p>
          <h2 className="mt-5 max-w-2xl text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            Thirteen years of it, and the companies are all real.
          </h2>
          <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-5 py-6"
              >
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block text-3xl font-bold tracking-[-0.03em]">{value}</span>
                  <span className="mt-2 block text-sm text-slate-600">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
          <Link
            href={buildMarketingHref('/consulting', isLocalhost)}
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:text-sky-900"
          >
            See the companies behind these numbers
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </Reveal>

      <Reveal className="bg-[var(--marketing-surface)] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
            Products
          </p>
          <h2 className="mt-5 max-w-2xl text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            Software we built, sell and run ourselves.
          </h2>
          <p className="mt-5 max-w-2xl leading-8 text-slate-600">
            Live products with paying customers, which means we carry the
            support, the billing and the uptime. The full story of each one is on
            its own page.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {productStrip.map((product) => (
              <article
                key={product.name}
                className="flex flex-col rounded-[2rem] border border-[var(--marketing-border)] bg-white p-7"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold tracking-[-0.02em]">{product.name}</h3>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                    Live
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {product.sector}
                </p>
                <p className="mt-4 flex-1 leading-7 text-slate-600">{product.summary}</p>
                <Link
                  href={buildMarketingHref(product.href, isLocalhost)}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:text-sky-900"
                >
                  {product.cta}
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </article>
            ))}
          </div>

          <Link
            href={buildMarketingHref('/products', isLocalhost)}
            className="mt-10 inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
          >
            All products
          </Link>
        </div>
      </Reveal>

      <Reveal
        id="blog"
        className="bg-[var(--marketing-surface)] px-6 py-20 md:px-8 md:py-24"
      >
        <div className="mx-auto max-w-[1100px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
                Thinking
              </p>
              <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
                From the blog
              </h2>
            </div>
            <Link
              href={buildMarketingHref('/blog', isLocalhost)}
              className="text-sm font-semibold text-sky-600 transition hover:text-sky-700"
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
                      className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={buildMarketingHref(`/blog/${post.slug}`, isLocalhost)}
                  className="mt-6 inline-flex text-sm font-semibold text-sky-600 transition hover:text-sky-700"
                >
                  Read more →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal id="contact" className="scroll-mt-24 px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[1.1fr_0.75fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
              Get in touch
            </p>
            <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
              Let&apos;s talk
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Whether you&apos;re looking for commercial consultancy, a
              development partner, or just want to find out more, we&apos;d
              love to hear from you.
            </p>
            <div className="mt-10">
              <ContactForm />
            </div>
          </div>

          <ContactDetailsCard includeLegalNote isLocalhost={isLocalhost} />
        </div>
      </Reveal>
    </div>
  )
}
