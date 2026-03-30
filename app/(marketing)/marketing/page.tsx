import Link from 'next/link'
import { headers } from 'next/headers'
import ContactDetailsCard from '@/components/marketing/ContactDetailsCard'
import ContactForm from '@/components/marketing/ContactForm'
import Reveal from '@/components/marketing/Reveal'
import { formatBlogDate } from '@/lib/blog'
import { getPublishedBlogPosts } from '@/lib/db/blog-posts'
import { createClient } from '@/lib/supabase/server'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'

const services = [
  {
    title: 'Brand & NGP Consulting',
    description:
      '13+ years in nicotine pouches, vaping, and adjacent FMCG categories across UK and European markets. From market entry strategy to distributor relationships and channel pricing — we know this space.',
    cta: 'Talk to us →',
    href: '#contact',
    icon: (
      <svg
        viewBox="0 0 48 48"
        className="h-10 w-10 text-sky-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M10 34V22" />
        <path d="M24 34V14" />
        <path d="M38 34V8" />
        <path d="M7 38H41" />
      </svg>
    ),
  },
  {
    title: 'Bespoke App Development',
    description:
      'We build internal tools, client portals, and SaaS products that actually get used. From discovery to deployment — working closely with you throughout.',
    cta: 'Start a project →',
    href: '#contact',
    icon: (
      <svg
        viewBox="0 0 48 48"
        className="h-10 w-10 text-sky-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M18 14L8 24l10 10" />
        <path d="M30 14l10 10-10 10" />
      </svg>
    ),
  },
  {
    title: 'MVP Cricket',
    description:
      'A SaaS platform purpose-built for grassroots cricket clubs. Automated MVP scoring, Play-Cricket integration, leaderboards, and club management — all in one place.',
    cta: 'Learn more →',
    href: '/mvp-cricket',
    icon: (
      <svg
        viewBox="0 0 48 48"
        className="h-10 w-10 text-sky-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <circle cx="18" cy="18" r="8" />
        <path d="M24 24l12 12" />
      </svg>
    ),
  },
]

const stats = [
  ['13+', 'Years in NGP & FMCG'],
  ['5', 'Active workstreams'],
  ['3', 'Countries served'],
  ['2026', 'Founded'],
]

const leaderboardRows = [
  ['1', 'A. Turner', '128'],
  ['2', 'L. Briggs', '117'],
  ['3', 'J. Wood', '110'],
  ['4', 'M. Fletcher', '102'],
  ['5', 'C. Shaw', '96'],
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
            <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-[-0.05em] text-[var(--marketing-text)] md:text-[56px]">
              Commercial strategy. Digital products. Built to last.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 md:text-xl">
              We help brands grow in competitive markets — from NGP and FMCG
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
                href={buildMarketingHref('/#services', isLocalhost)}
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
        className="bg-[var(--marketing-surface)] px-6 py-20 md:px-8 md:py-24"
      >
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
            What we do
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {services.map((service) => (
              <article
                key={service.title}
                className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-8 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50">
                  {service.icon}
                </div>
                <h2 className="mt-6 text-2xl font-bold tracking-[-0.03em]">
                  {service.title}
                </h2>
                <p className="mt-4 text-[0.98rem] leading-8 text-slate-600">
                  {service.description}
                </p>
                <Link
                  href={buildMarketingHref(service.href, isLocalhost)}
                  className="mt-6 inline-flex text-sm font-semibold text-sky-600 transition hover:text-sky-700"
                >
                  {service.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
              About
            </p>
            <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
              One company. Multiple workstreams.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Trailhead Holdings is the holding company for Rob Harvey&apos;s
              portfolio of commercial and digital ventures. Rather than
              spreading across multiple entities, everything runs through one
              lean, tech-enabled operation.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map(([value, label]) => (
              <div
                key={label}
                className="rounded-[1.75rem] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-7"
              >
                <p className="text-4xl font-bold tracking-[-0.05em] text-[var(--marketing-text)]">
                  {value}
                </p>
                <p className="mt-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="bg-slate-950 px-6 py-20 text-slate-50 md:px-8 md:py-24">
        <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-300">
              Our SaaS product
            </p>
            <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
              MVP Cricket
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Designed for grassroots clubs who deserve better than
              spreadsheets. Automated scoring, Play-Cricket sync, and a
              leaderboard your players will actually check.
            </p>
            <Link
              href="https://mvpcricket.app"
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400"
            >
              Visit mvpcricket.app →
            </Link>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_35px_80px_-45px_rgba(14,165,233,0.55)] backdrop-blur">
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-900 p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-300">
                    Leaderboard
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    Saturday 1st XI
                  </h3>
                </div>
                <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-200">
                  Live sync
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {leaderboardRows.map(([position, name, score]) => (
                  <div
                    key={name}
                    className="grid grid-cols-[56px_1fr_72px] items-center rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm"
                  >
                    <span className="font-semibold text-sky-300">
                      #{position}
                    </span>
                    <span>{name}</span>
                    <span className="text-right font-semibold text-white">
                      {score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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

      <Reveal id="contact" className="px-6 py-20 md:px-8 md:py-24">
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
              development partner, or just want to find out more — we&apos;d
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
