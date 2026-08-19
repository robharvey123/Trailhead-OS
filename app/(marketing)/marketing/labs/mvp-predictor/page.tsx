import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'

// MVP Predictor is the one Labs product with no marketing site of its own yet,
// so its page lives here until mvppredictor.com is wired up. Then it
// follows Engineer OS and MVP Cricket out behind a 301.
export const metadata: Metadata = buildMetadata({
  title: 'MVP Predictor',
  description:
    'White-label Premier League prediction competitions for clubs. Members predict, the club runs the competition, and the entry money never touches the platform.',
  path: '/labs/mvp-predictor',
  keywords: [
    'MVP Predictor',
    'football prediction competition for clubs',
    'white label prediction game',
  ],
})

const howItWorks = [
  {
    title: 'The club runs the competition',
    description:
      'Your club gets its own branded prediction competition: your name, your members, your rules. Members predict Premier League results each week and a live leaderboard does the rest.',
  },
  {
    title: 'Flat subscription, no cut',
    description:
      'Clubs pay a flat subscription for the platform. Entry money, prize pots and payouts stay entirely between the club and its members. None of it ever touches us.',
  },
  {
    title: 'Proven before it was a product',
    description:
      'The engine started as a single club’s World Cup 2026 prediction competition, built for a real committee and run through a real tournament. MVP Predictor is that build made multi-tenant.',
  },
]

export default async function MvpPredictorPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
      <section className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <Link
            href={buildMarketingHref('/labs', isLocalhost)}
            className="inline-flex items-center text-sm font-semibold text-[var(--marketing-accent)] transition hover:text-[var(--marketing-accent-strong)]"
          >
            ← Trailhead Labs
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--marketing-accent)]">
              MVP Predictor
            </p>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
              In build
            </span>
          </div>
          <h1 className="mt-5 max-w-3xl text-5xl font-bold tracking-[-0.05em] md:text-[56px]">
            Your club&rsquo;s prediction league, without the spreadsheet.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            White-label Premier League prediction competitions for clubs.
            Members predict, the leaderboard updates itself, and the volunteer
            who used to score it all by hand gets their Saturday back.
          </p>
        </div>
      </section>

      <Reveal>
        <section className="border-t border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <div className="grid gap-5 md:grid-cols-3">
              {howItWorks.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-7"
                >
                  <h2 className="text-xl font-bold tracking-[-0.02em]">{item.title}</h2>
                  <p className="mt-3 leading-7 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px] rounded-[2rem] bg-slate-950 px-8 py-14 text-white md:px-14">
            <h2 className="max-w-2xl text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              Want it for your club&rsquo;s next season?
            </h2>
            <p className="mt-5 max-w-2xl leading-8 text-slate-300">
              MVP Predictor is in build now. Tell us about your club and we will
              let you know when it is taking its first competitions.
            </p>
            <Link
              href={buildMarketingHref('/contact?track=labs', isLocalhost)}
              className="mt-9 inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Register interest
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  )
}
