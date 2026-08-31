import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import PlanIcon from '@/components/marketing/PlanIcon'
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
    code: 'MVP-01',
    title: 'The club runs the competition',
    description:
      'Your club gets its own branded prediction competition: your name, your members, your rules. Members predict Premier League results each week and a live leaderboard does the rest.',
  },
  {
    code: 'MVP-02',
    title: 'Flat subscription, no cut',
    description:
      'Clubs pay a flat subscription for the platform. Entry money, prize pots and payouts stay entirely between the club and its members. None of it ever touches us.',
  },
  {
    code: 'MVP-03',
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
      <section className="pt-10 pb-10 md:pt-14 md:pb-12">
        <div className="bay">
          <div className="bay-code bay-code-lead">
            <Link
              href={buildMarketingHref('/labs', isLocalhost)}
              className="plan-label inline-flex items-center gap-2 text-[var(--ink-2)] transition-colors hover:text-[var(--flash)]"
            >
              <PlanIcon name="left" size={13} />
              Trailhead Labs
            </Link>
            <div className="mt-6 border-t border-[var(--hair)] pt-3">
              <p className="plan-data text-[var(--ink-3)]">LAB-03</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">MVP Predictor</p>
            </div>
          </div>

          <div className="min-w-0">
            <span className="key-state key-build">In build</span>
            <h1 className="plan-display rack mt-5 max-w-[14ch]">
              Your club&rsquo;s prediction league, without the spreadsheet.
            </h1>
            <p className="plan-lede mt-7">
              White-label Premier League prediction competitions for clubs.
              Members predict, the leaderboard updates itself, and the volunteer
              who used to score it all by hand gets their Saturday back.
            </p>
          </div>
        </div>
      </section>

      <Reveal className="rail bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">HOW</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">It works</p>
          </div>
          <div className="min-w-0">
            <div className="facings md:grid-cols-3">
              {howItWorks.map((item) => (
                <article key={item.title} className="facing bg-[var(--plan)]">
                  <p className="plan-data text-[var(--ink-3)]">{item.code}</p>
                  <h2 className="plan-h3 mt-3">{item.title}</h2>
                  <p className="plan-body mt-3 plan-body-sm">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal className="rail brand-block">
        <div className="bay py-14 md:py-20">
          <div className="bay-code">
            <p className="plan-note opacity-70" style={{ color: 'var(--key-ink)' }}>
              End of bay
            </p>
          </div>
          <div className="min-w-0">
            <h2
              className="plan-h2 rack-target max-w-[18ch]"
              style={{ color: 'var(--key-ink)' }}
            >
              Want it for your club&rsquo;s next season?
            </h2>
            <p className="plan-lede mt-6">
              MVP Predictor is in build now. Tell us about your club and we will
              let you know when it is taking its first competitions.
            </p>
            <div className="ticket mt-9 max-w-md">
              <p className="plan-data text-[var(--ink-3)]">
                NOT YET TAKING COMPETITIONS
              </p>
              <div className="ticket-rule">
                <Link
                  href={buildMarketingHref('/contact?track=labs', isLocalhost)}
                  className="flash"
                >
                  Register interest
                  <PlanIcon name="right" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
