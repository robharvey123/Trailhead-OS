import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import PlanIcon from '@/components/marketing/PlanIcon'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { absoluteUrl, buildMetadata } from '@/lib/seo'
import { BreadcrumbJsonLd, SoftwareApplicationJsonLd } from '@/components/JsonLd'

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

// The rules as built, from the product's locked decisions. Club-specific
// money (entry fees, prize amounts) is deliberately absent: each club sets
// its own, and the platform never holds it.
const seasonRules: Array<[string, string]> = [
  ['Scoring', '3 points for the exact score, 1 for the right result.'],
  ['Fixtures', 'Every Premier League fixture, gameweek by gameweek. Results arrive from a live feed, so nobody marks anything by hand.'],
  ['Tables', 'Weekly, monthly and season leaderboards, all updating as results land.'],
  ['Season', 'Your best 30 of the 38 gameweeks count, so a missed weekend does not end anyone’s season.'],
  ['Weekly pot', 'The outright top score takes it. A tie rolls the pot into the next gameweek.'],
  ['Bonus slips', 'Season-long questions answered in two windows, for the longer calls.'],
  ['Late joiners', 'Members can join up to the final kickoff of gameweek 4.'],
]

const clubControls = [
  {
    code: 'CLB-01',
    title: 'Your name, your colours',
    description:
      'The competition carries your club’s name, crest and colour. Members see their club, not ours.',
  },
  {
    code: 'CLB-02',
    title: 'Your members, by invite',
    description:
      'Members join from an invite link the club shares. Club admins see who has joined and mark who has paid.',
  },
  {
    code: 'CLB-03',
    title: 'Your money, your prizes',
    description:
      'The club sets the entry fee and how prizes are split, and collects entries itself. None of it passes through the platform.',
  },
]

const questions = [
  {
    question: 'Does the entry money go through you?',
    answer:
      'No. The club collects entries and pays prizes directly. MVP Predictor charges the club a flat subscription for the platform and never handles, holds or takes a share of members’ money.',
  },
  {
    question: 'What does it cost?',
    answer:
      'A flat subscription per club. The price will be published here before clubs are taken on, and it will not change with the size of your entry pot.',
  },
  {
    question: 'Who keeps the scores?',
    answer:
      'Nobody. Fixtures and results come from a live data feed, and the scoring and every leaderboard update automatically.',
  },
  {
    question: 'Can members join after the season starts?',
    answer:
      'Yes, up to the final kickoff of gameweek 4. After that the competition is closed to new entries for the season.',
  },
  {
    question: 'Where did it come from?',
    answer:
      'A World Cup 2026 prediction competition built for one club’s committee and run through the whole tournament. MVP Predictor is that build, turned into a product any club can run.',
  },
]

export default async function MvpPredictorPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
      {/* The product's own entity lives on its own page; /labs carries the
          same @id, so both describe one product. No offers until a price is
          set, and no ratings that do not exist. */}
      <SoftwareApplicationJsonLd
        name="MVP Predictor"
        description="White-label football prediction competitions for clubs, run on a flat club subscription."
        url={absoluteUrl('/labs/mvp-predictor')}
        applicationCategory="SportsApplication"
        mainEntityOfPage={absoluteUrl('/labs/mvp-predictor')}
      />
      <BreadcrumbJsonLd items={[{ name: 'Labs', path: '/labs' }, { name: 'MVP Predictor', path: '/labs/mvp-predictor' }]} />
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

      {/* ---- The rules, as a ruled list ---- */}
      <Reveal className="rail">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">SEASON</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">38 gameweeks</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">How a season plays out</h2>
            <dl className="mt-8 border-t border-[var(--ink)]">
              {seasonRules.map(([label, rule]) => (
                <div
                  key={label}
                  className="grid gap-x-8 gap-y-1 border-b border-[var(--hair)] py-4 md:grid-cols-[10rem_minmax(0,1fr)] md:items-baseline"
                >
                  <dt className="plan-label text-[var(--ink)]">{label}</dt>
                  <dd className="plan-body plan-body-sm">{rule}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Reveal>

      {/* ---- What the club controls ---- */}
      <Reveal className="rail bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">CLUB</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">3 facings</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">What the club controls</h2>
            <div className="facings mt-8 md:grid-cols-3">
              {clubControls.map((item) => (
                <div key={item.code} className="facing bg-[var(--plan)]">
                  <p className="plan-data text-[var(--ink-3)]">{item.code}</p>
                  <h3 className="plan-h3 mt-3">{item.title}</h3>
                  <p className="plan-body mt-3 plan-body-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- Questions ---- */}
      <Reveal className="rail">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">FAQ</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Asked first</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">Questions clubs ask</h2>
            <div className="mt-8 border-t border-[var(--ink)]">
              {questions.map((item) => (
                <details key={item.question} className="group border-b border-[var(--hair)]">
                  <summary className="plan-h3 flex max-w-3xl cursor-pointer list-none items-center justify-between gap-4 py-4 marker:content-none">
                    {item.question}
                    <PlanIcon
                      name="cross"
                      size={15}
                      className="text-[var(--ink-2)] transition-transform group-open:rotate-45"
                    />
                  </summary>
                  <p className="plan-body pb-5 plan-body-sm">{item.answer}</p>
                </details>
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
