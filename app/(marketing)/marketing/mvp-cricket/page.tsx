import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'MVP Cricket, Club Management for Grassroots Cricket',
  description:
    'MVP Cricket is a multi-tenant club management platform for grassroots cricket. Play-Cricket sync, automated MVP scoring, member notifications and subscriptions.',
  path: '/mvp-cricket',
  keywords: [
    'cricket club management software',
    'grassroots cricket app',
    'play-cricket integration',
    'cricket club admin software UK',
  ],
})

const capabilities = [
  {
    title: 'Scoring that reflects the club',
    description:
      'An automated MVP engine built around how clubs actually recognise contribution — not just runs and wickets, but the things that keep a season running.',
  },
  {
    title: 'Play-Cricket sync',
    description:
      'Fixtures, results and the player registry pull in automatically on a daily schedule, so the volunteer who used to retype it all no longer has to.',
  },
  {
    title: 'Leaderboards worth checking',
    description:
      'Player and club standings that update through the season, giving members a reason to come back to the app between matches.',
  },
  {
    title: 'Multi-club by design',
    description:
      'Leagues and groups running more than one team get proper tenant separation rather than a shared spreadsheet with more tabs.',
  },
  {
    title: 'Notifications members actually get',
    description:
      'Web push and email, with per-member preferences respected at the point the message is queued rather than after it has already been sent.',
  },
  {
    title: 'Subscriptions and invitations',
    description:
      'Stripe-backed tiers, magic-link auth and emailed invitations to bring a committee onto the platform without a password reset thread.',
  },
]

const architecture = [
  {
    title: 'A monorepo, not a single app',
    description:
      'Turborepo and pnpm workspaces split the system into a Next.js 15 web app and separate packages for the database, Play-Cricket integration, scoring, Stripe and email. Each part is testable on its own and the scoring rules are not tangled into page code.',
  },
  {
    title: 'Tenant isolation in the database',
    description:
      'The web app holds only an anon key — there is no service-role key in it at all. Every read and write goes through row-level security, and club creation runs through a security-definer RPC so the club and its first admin commit atomically or not at all.',
  },
  {
    title: 'Sync as an Edge Function',
    description:
      'Play-Cricket integration is a pure fetch-parse-transform library with no database imports, consumed by a Supabase Edge Function on a daily pg_cron schedule. API tokens live in an admin-only table and are never returned to the client after saving.',
  },
  {
    title: 'An outbox for notifications',
    description:
      'User actions enqueue notifications through a database function that resolves preferences and deduplicates, then a worker claims rows with FOR UPDATE SKIP LOCKED and retries three times. A five-minute sweep catches anything stranded, so a failed send is recoverable rather than lost.',
  },
  {
    title: 'Web push written to the spec',
    description:
      'The push implementation is hand-rolled on WebCrypto against RFC 8291 and RFC 8292, because the usual library exceeds the edge runtime’s CPU limit. It is verified by a test that actually decrypts a payload and validates the signature, and dead subscriptions are pruned automatically.',
  },
  {
    title: 'Rebuilt, then migrated',
    description:
      'This is the second generation. The original platform was replaced rather than patched, and the live club was migrated across on a scripted runbook with a rollback at every step — the old system left intact throughout as an archive.',
  },
]

const stack = [
  'Turborepo',
  'pnpm workspaces',
  'Next.js 15',
  'TypeScript (strict)',
  'Tailwind v4',
  'Supabase',
  'Edge Functions',
  'pg_cron',
  'Stripe',
  'Resend',
  'Vercel',
]

export default async function MvpCricketPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
      <section className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
              MVP Cricket
            </p>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
              Live
            </span>
          </div>

          <h1 className="mt-5 max-w-3xl text-5xl font-bold tracking-[-0.05em] md:text-[56px]">
            Your club runs on one volunteer and a spreadsheet.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Everyone wants to recognise what players contribute and keep members
            engaged through a season. In practice the scoring gets done late, or
            not at all, and the thing that would keep players checking in never
            quite happens. MVP Cricket takes that job off whoever is currently
            carrying it.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="https://mvpcricket.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-sky-700 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-800"
            >
              Visit mvpcricket.app
            </a>
            <Link
              href={buildMarketingHref('/contact', isLocalhost)}
              className="inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] px-6 py-3.5 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
            >
              Talk to us about a build
            </Link>
          </div>

          <p className="mt-8 text-sm leading-7 text-slate-600">
            Tiered subscription pricing from{' '}
            <strong className="font-semibold text-[var(--marketing-text)]">£19 a month</strong>, with a
            custom tier for multi-club operators. A worked example of taking a
            product from idea to billing customers without outside investment.
          </p>
        </div>
      </section>

      <Reveal>
        <section className="border-t border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">What it does</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-7"
                >
                  <h3 className="text-lg font-bold tracking-[-0.02em]">{item.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">How it is built</h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600">
              The second generation of this platform, rebuilt as a monorepo. If
              you are weighing us up for a build, this is the level of structure
              we bring to something with real multi-tenancy in it.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {architecture.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-7"
                >
                  <h3 className="text-lg font-bold tracking-[-0.02em]">{item.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Stack
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {stack.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-4 py-2 text-xs font-semibold text-slate-600"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="px-6 pb-16 md:px-8 md:pb-20">
          <div className="mx-auto max-w-[1100px] rounded-[2rem] bg-slate-950 px-8 py-14 text-white md:px-14">
            <h2 className="max-w-2xl text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              Runs a club? Or need something like this for a different sport?
            </h2>
            <p className="mt-5 max-w-2xl leading-8 text-slate-300">
              MVP Cricket is live and taking clubs today. The same architecture —
              multi-tenant, integration-fed, notification-driven — is what we
              build for membership organisations generally.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <a
                href="https://mvpcricket.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Visit mvpcricket.app
              </a>
              <Link
                href={buildMarketingHref('/contact', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Talk to us about a build
              </Link>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  )
}
