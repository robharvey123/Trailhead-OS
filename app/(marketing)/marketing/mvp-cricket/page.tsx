import Link from 'next/link'
import { headers } from 'next/headers'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'

const features = [
  {
    title: 'Scoring engine',
    description:
      'Automated MVP calculations built around the way grassroots clubs actually score matches and recognise contributions.',
  },
  {
    title: 'Play-Cricket sync',
    description:
      'Pull in fixtures and results without extra admin. Keep your club records in step with the systems you already use.',
  },
  {
    title: 'Leaderboards',
    description:
      'Make player performance visible with live standings, weekly snapshots, and a leaderboard your members will keep checking.',
  },
  {
    title: 'Multi-club support',
    description:
      'Designed to support more than one club setup, making it suitable for operators managing leagues, groups, or multiple teams.',
  },
]

const pricing = [
  {
    name: 'Starter',
    price: '£19/mo',
    description:
      'Perfect for single-club rollouts getting started with automated MVP scoring.',
  },
  {
    name: 'Club',
    price: '£39/mo',
    description:
      'For clubs that want scoring, leaderboards, and smoother player comms in one place.',
  },
  {
    name: 'Multi-Club',
    price: 'Custom',
    description:
      'For organisations managing multiple clubs, competitions, or a wider member network.',
  },
]

export default async function MvpCricketPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
      <section className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
              MVP Cricket
            </p>
            <h1 className="mt-5 text-5xl font-bold tracking-[-0.05em] md:text-[56px]">
              Built for grassroots cricket clubs that want a better operating
              rhythm.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              MVP Cricket turns spreadsheets, manual scoring summaries, and
              scattered club admin into one clear system for performance
              tracking and engagement.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="https://mvpcricket.app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-600"
              >
                Visit mvpcricket.app
              </Link>
              <Link
                href={buildMarketingHref('/#contact', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] px-6 py-3.5 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
              >
                Talk to us
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--marketing-border)] bg-[linear-gradient(180deg,#F8FAFC_0%,#EFF6FF_100%)] p-6">
            <div className="rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-[0_20px_60px_-40px_rgba(14,165,233,0.45)]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                    Season standings
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                    Derbyshire League
                  </h2>
                </div>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                  2026
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {[
                  ['Belper CC', '1st', '492'],
                  ['Milford Hall', '2nd', '468'],
                  ['Ashbourne', '3rd', '451'],
                ].map(([club, position, score]) => (
                  <div
                    key={club}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-2xl border border-slate-100 px-4 py-3"
                  >
                    <span className="font-semibold text-slate-800">{club}</span>
                    <span className="text-sm text-slate-500">{position}</span>
                    <span className="font-semibold text-sky-600">{score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Reveal className="bg-[var(--marketing-surface)] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
            Features
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-8"
              >
                <h2 className="text-2xl font-bold tracking-[-0.03em]">
                  {feature.title}
                </h2>
                <p className="mt-4 text-[0.98rem] leading-8 text-slate-600">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">
            Pricing
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {pricing.map((tier) => (
              <article
                key={tier.name}
                className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-8 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {tier.name}
                </p>
                <h2 className="mt-4 text-4xl font-bold tracking-[-0.04em]">
                  {tier.price}
                </h2>
                <p className="mt-4 text-[0.98rem] leading-8 text-slate-600">
                  {tier.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="bg-slate-950 px-6 py-20 text-white md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px] text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-300">
            Ready to see it in action?
          </p>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            Bring MVP Cricket into your club workflow.
          </h2>
          <Link
            href="https://mvpcricket.app"
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400"
          >
            Visit mvpcricket.app
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
