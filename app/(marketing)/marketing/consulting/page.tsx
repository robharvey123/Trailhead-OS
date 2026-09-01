import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import PlanIcon from '@/components/marketing/PlanIcon'
import PlateSlot from '@/components/marketing/PlateSlot'
import Reveal from '@/components/marketing/Reveal'
import { ProfessionalServiceJsonLd } from '@/components/JsonLd'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { absoluteUrl, buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Trailhead Commercial: NGP & FMCG Consulting',
  description:
    'Commercial strategy, market entry and route-to-market for nicotine, reduced-risk and FMCG brands. Thirteen years operating in the category, six markets, one exit.',
  path: '/consulting',
  // This page owns the consulting keyword pool; the homepage carries brand
  // terms only and /studio owns the software pool.
  keywords: [
    'nicotine pouch consultant',
    'NGP market entry',
    'FMCG route to market UK',
    'distributor strategy UK EU',
    'interim commercial director FMCG',
  ],
})

// The value chain, factory gate to shelf. This is the artifact behind the
// headline: pricing architecture that survives every party in the middle is
// the named service, so the page shows the ladder rather than asserting it.
//
// Structure is real; every figure is redacted, because the numbers belong to a
// client's brief and inventing plausible ones would be the exact failure this
// page exists to avoid.
const valueChain = [
  ['01', 'Factory gate', 'Cost of goods, ex works'],
  ['02', 'Landed', 'Freight, duty, excise where it applies'],
  ['03', 'Distributor', 'Their margin, and whether it holds'],
  ['04', 'Wholesale', 'Depot terms, listing costs, rebates'],
  ['05', 'Retail', 'Shelf margin the buyer will actually accept'],
  ['06', 'Shelf', 'What the consumer pays'],
]

// Rendered as a dimension rail rather than four stat cards: on a plan a figure
// is a measurement hung off the rule, not a tile.
const dimensions = [
  ['13+', 'Years in NGP & FMCG'],
  ['6', 'International markets operated in'],
  ['£5M+', 'Revenue built from scratch'],
  ['1', 'Successful founder exit'],
]

const services = [
  {
    code: 'SVC-01',
    title: 'Market entry',
    description:
      'Taking a brand into a market it has never sold in. Regulatory lay of the land, distributor shortlist, pricing that survives the value chain, and the first orders on the board. UK, EU, DACH, Sweden.',
  },
  {
    code: 'SVC-02',
    title: 'Route to market',
    description:
      'Deciding which doors are worth knocking on and in what order. Channel strategy across D2C, retail and wholesale, and the commercial terms that make each one work rather than just look busy.',
  },
  {
    code: 'SVC-03',
    title: 'Pricing and portfolio',
    description:
      'Pricing architecture from factory gate to shelf, margin modelling for every party in the chain, and SKU rationalisation for ranges that grew faster than they were planned.',
  },
  {
    code: 'SVC-04',
    title: 'Interim commercial leadership',
    description:
      'Running the commercial function directly while you hire, or while the business is too early to justify a permanent director. Sales, distribution and the numbers that follow them.',
  },
]

// Live client engagements under Trailhead Commercial, kept separate from the
// employment history below. Everything in trackRecord is a role Rob held; a
// page made only of those reads as a CV rather than a consultancy, and a buyer
// cannot tell whether this is a going concern. One live engagement answers it.
//
// Mandate and scope only. Commercial terms, target account names and anything
// still under negotiation stay off a public page.
const currentWork = [
  {
    client: 'Qola',
    mandate: 'UK and EU commercial',
    period: 'Aug 2026 to date',
    summary:
      'Nicotine pouch brand entering the UK and EU. Route to market across distribution and retail, pricing architecture that holds through the value chain, and the named account work that turns a listing conversation into a first order. Initial term runs to November 2026.',
  },
]

// `years` drives the elevation bar. It is tenure, nothing else — the bar is a
// measurement, so it may never be tuned for looks.
const trackRecord = [
  {
    period: '2024–26',
    years: 2,
    company: 'Dholakia Tobacco',
    role: 'Head of Sales and Business Development',
    summary:
      'RUSH and PAZ nicotine pouches. UK and EU expansion across DACH, Sweden, Italy, and South Africa.',
  },
  {
    period: '2023–24',
    years: 1,
    company: 'RoarLabs',
    role: 'Chief Executive Officer',
    summary:
      'Built a reduced-risk nicotine brand from the ground up. Full UK launch delivered in six months.',
  },
  {
    period: '2022–23',
    years: 1,
    company: 'Flonq',
    role: 'Head of Sales UK',
    summary:
      'UK market entry for e-cigarettes from zero. Retail and distribution coverage built within twelve months.',
  },
  {
    period: '2020–22',
    years: 2,
    company: 'V&YOU',
    role: 'Head of Sales and Marketing',
    summary:
      '£1M+ annual revenue. National UK distribution secured through Unitas.',
  },
  {
    period: '2014–20',
    years: 6,
    company: 'EOS Leisure',
    role: 'Founder and CCO',
    summary:
      "One of the UK's leading vaping and CBD companies. £1,500 start-up to £5M+ turnover. £4M raised. Successful exit in 2019.",
  },
]

const MAX_TENURE = Math.max(...trackRecord.map((entry) => entry.years))

// The operator. Everything on this page rests on one claim, that you are
// buying a person rather than an agency, and until this landed the person
// never appeared. It sits in the hero, because that is where the claim is made.
const PORTRAIT: string | undefined = '/rob-harvey.webp'

const categories = [
  'Nicotine Pouches',
  'Vaping',
  'Caffeine Pouches',
  'CBD',
  'Reduced-Risk',
  'FMCG',
  'D2C',
  'UK and Europe',
]

// The shape of pricing, not a rate card. A brand owner deciding whether to
// start a conversation needs to know how the money works before they will.
const engagementShapes = [
  {
    code: 'ENG-01',
    title: 'Scoped project',
    shape: 'Fixed price, agreed in writing before work starts',
    description:
      'A defined piece of work with a defined end: a market entry plan, a distributor search, a pricing review. You see the price and the deliverable before you commit to either.',
  },
  {
    code: 'ENG-02',
    title: 'Interim leadership',
    shape: 'Monthly retainer against an agreed day commitment',
    description:
      'Running the commercial function while you hire, or while the business is too early to justify a permanent director. Reviewed quarterly, and built to make itself redundant.',
  },
  {
    code: 'ENG-03',
    title: 'Advisory',
    shape: 'Short and fixed-fee',
    description:
      'A second pair of eyes on a deal, a distributor negotiation or a market you are weighing up. Days rather than months, priced as such.',
  },
]

const faqs = [
  {
    question: 'Who actually does the work?',
    answer:
      'Rob Harvey. There is no account manager and no junior team. The person who scopes the work is the person who does it, which is the main reason the client list is short.',
  },
  {
    question: 'How do engagements usually start?',
    answer:
      'A conversation, then a written scope with a fixed price before anything is committed. Most start as a defined piece of work (a market entry plan, a pricing review), and some continue as an ongoing interim role.',
  },
  {
    question: 'Do you work outside nicotine and FMCG?',
    answer:
      'Sometimes, but the deep experience is in nicotine, reduced-risk and adjacent FMCG. If a brief sits outside that, we will say so rather than learn on your budget.',
  },
  {
    question: 'Is this related to the software side of the business?',
    answer:
      'They are separate lines of work with the same operator behind them. Occasionally they meet: a client needs an internal tool the market does not sell. When that happens we can build it. Neither is a route into selling the other.',
  },
]

export default async function ConsultingPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
      <ProfessionalServiceJsonLd
        name="Trailhead Commercial"
        description="NGP and FMCG commercial consulting: market entry, route to market, pricing and interim commercial leadership for nicotine and reduced-risk brands."
        url={absoluteUrl('/consulting')}
        serviceTypes={[
          'Market entry strategy',
          'Route to market and channel strategy',
          'Pricing and portfolio architecture',
          'Interim commercial leadership',
        ]}
      />

      {/* ---- Hero ---- */}
      <section className="scroll-mt-24 pt-10 pb-10 md:pt-16 md:pb-12">
        <div className="bay">
          <div className="bay-code hidden lg:block">
            <p className="plan-data text-[var(--ink-3)]">BAY 01</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Commercial</p>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
            <div className="min-w-0">
            <h1 className="plan-display rack max-w-[16ch]">
              You have a brand. It needs to sell somewhere it isn&rsquo;t
              selling yet.
            </h1>
            <p className="plan-lede mt-7">
              Maybe that is a new market, a distributor who has gone quiet, or
              pricing that leaves nothing for anyone in the middle. Most advice
              in this category comes from people who have read about it. This
              comes from thirteen years of doing it. Six markets, a brand taken
              from £1,500 to a £5M exit, and the distribution deals that made
              each of them work.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href={buildMarketingHref('/contact?track=commercial', isLocalhost)}
                className="flash justify-center"
              >
                Start a conversation
              </Link>
              <Link
                href={buildMarketingHref('/studio', isLocalhost)}
                className="flash-ghost justify-center"
              >
                Looking for software instead?
              </Link>
            </div>
            </div>

            {/* The operator, on a ticket, because the person is the offer. */}
            <div className="lg:pt-2">
              <PlateSlot
                src={PORTRAIT}
                alt="Rob Harvey, arms folded at a stand table"
                width={1066}
                height={1600}
                className="max-w-[15rem]"
                priority
              />
              <div className="ticket mt-4 max-w-[15rem]">
                <p className="plan-label text-[var(--ink)]">Rob Harvey</p>
                <p className="plan-data mt-1.5 text-[var(--ink-3)]">
                  TRAILHEAD COMMERCIAL
                </p>
                <p className="plan-body ticket-rule plan-body-xs">
                  There is no account manager and no junior team. The person who
                  scopes the work is the person who does it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- The artifact, not the assertion --------------------------------
           The headline claims pricing that survives the value chain. This is
           that chain, drawn. Figures are redacted rather than invented: the
           structure is ours to show, the numbers are the client's. */}
      <section className="rail">
        <div className="bay py-10 md:py-12">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">PRC-01</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Value chain</p>
          </div>

          <figure className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <figcaption className="plan-h3">
                Pricing architecture, factory gate to shelf
              </figcaption>
              <span className="key-state key-illustrative">Structure only</span>
            </div>

            <ol className="mt-5 border-t border-[var(--ink)]">
              {valueChain.map(([step, stage, note]) => (
                <li
                  key={step}
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-[var(--hair)] py-3 md:grid-cols-[2.5rem_11rem_minmax(0,1fr)_auto]"
                >
                  <span className="plan-data text-[var(--ink-3)]">{step}</span>
                  <span
                    className="plan-body-sm font-bold text-[var(--ink)]"
                    style={{ fontStretch: '88%' }}
                  >
                    {stage}
                  </span>
                  <span className="col-span-2 flex min-w-0 items-baseline gap-4 md:col-span-1">
                    <span className="plan-body shrink-0 plan-body-xs">
                      {note}
                    </span>
                    {/* The leader, carrying the eye to the measure. */}
                    <span
                      aria-hidden="true"
                      className="hidden h-px flex-1 translate-y-[-0.3em] bg-[repeating-linear-gradient(to_right,var(--hair)_0_2px,transparent_2px_6px)] md:block"
                    />
                  </span>
                  {/* The margin, struck out rather than guessed at. */}
                  <span
                    aria-hidden="true"
                    className="hidden h-3 w-16 justify-self-end bg-[repeating-linear-gradient(45deg,var(--hair)_0_2px,transparent_2px_5px)] md:block"
                  />
                </li>
              ))}
            </ol>

            <p className="plan-body mt-4 plan-body-xs">
              Margins are redacted because they are yours. Modelling them for
              every party in the chain, and finding where the ladder stops
              holding, is usually the first week of the work.
            </p>
          </figure>
        </div>
      </section>

      {/* ---- Services ---- */}
      <Reveal id="services" className="rail scroll-mt-24 bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">SVC</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">4 facings</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">
              What we are usually brought in to do
            </h2>

            <div className="facings mt-8 md:grid-cols-2">
              {services.map((service) => (
                <div key={service.title} className="facing bg-[var(--plan)]">
                  <p className="plan-data text-[var(--ink-3)]">{service.code}</p>
                  <h3 className="plan-h3 mt-3">{service.title}</h3>
                  <p className="plan-body mt-3 plan-body-sm">
                    {service.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Category tickets: what sits on this bay. */}
            <div id="sectors" className="mt-10 scroll-mt-24">
              <p className="plan-data text-[var(--ink-3)]">CATEGORIES WORKED</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <li
                    key={category}
                    className="plan-label border border-[var(--hair)] bg-[var(--card)] px-2.5 py-2 text-[var(--ink-2)]"
                  >
                    {category}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- Current work ---- */}
      <Reveal id="current-work" className="rail scroll-mt-24">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">LIVE</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">On shelf</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">Current work</h2>
            <p className="plan-body mt-4">
              Live engagements, running now. Work in progress rather than a case
              study: results get published when there are results to publish.
            </p>

            <ul className="mt-8">
              {currentWork.map((entry) => (
                <li
                  key={entry.client}
                  className="brand-block border border-[var(--ink)] p-6 md:p-8"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3
                        className="plan-h3"
                        style={{ color: 'var(--key-ink)' }}
                      >
                        {entry.client}
                      </h3>
                      <span
                        className="key-state"
                        style={{ color: 'var(--key-ink)' }}
                      >
                        Live
                      </span>
                    </div>
                    <p
                      className="plan-data opacity-80"
                      style={{ color: 'var(--key-ink)' }}
                    >
                      {entry.period.toUpperCase()}
                    </p>
                  </div>
                  <p
                    className="plan-label mt-3"
                    style={{ color: 'var(--key-ink)' }}
                  >
                    {entry.mandate}
                  </p>
                  <p className="plan-body mt-4">{entry.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>

      {/* ---- Track record, drawn as a bay elevation --------------------
           Each role is a facing and the bar is its tenure to scale, so the
           shape of thirteen years is legible before a word is read. Everything
           before Trailhead prints as archive: the material carries its age. */}
      <Reveal id="track-record" className="rail scroll-mt-24 bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">ELEVATION</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">2014–26</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">Track record</h2>
            <p className="plan-body mt-4">
              The operating history behind the consultancy. Roles held, not
              clients billed. Every one is a real company with a real trading
              history, so look them up. That is rather the point of listing
              them.
            </p>

            <ol className="mt-8 border-t border-[var(--ink)]">
              {trackRecord.map((entry) => (
                <li
                  key={entry.company}
                  className="border-b border-[var(--hair)] py-6"
                >
                  <div className="grid gap-x-8 gap-y-3 md:grid-cols-[7.5rem_minmax(0,1fr)]">
                    <div>
                      <p className="plan-data text-[var(--ink-2)]">
                        {entry.period}
                      </p>
                      {/* The elevation bar: width is tenure, to scale. */}
                      <div
                        className="bar-tenure is-archive mt-2"
                        style={{
                          width: `${(entry.years / MAX_TENURE) * 100}%`,
                        }}
                        aria-hidden="true"
                      />
                      <p className="plan-data mt-1.5 text-[var(--ink-3)]">
                        {entry.years} YR{entry.years > 1 ? 'S' : ''}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <h3 className="plan-h3">{entry.company}</h3>
                      <p className="plan-label mt-2 text-[var(--key-deep)]">
                        {entry.role}
                      </p>
                      <p className="plan-body mt-3 plan-body-sm">
                        {entry.summary}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {/* The totals the elevation adds up to. They belong beside the
                thing that evidences them, not floating under the headline. */}
            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
              {dimensions.map(([value, label]) => (
                <div key={label} className="border-l border-[var(--hair)] pl-4">
                  <dt className="plan-note text-[var(--ink-3)]">{label}</dt>
                  <dd
                    className="plan-figure mt-1.5 text-[var(--key-deep)]"
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Reveal>

      {/* ---- Pricing shapes, as three tickets ---- */}
      <Reveal className="rail">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">ENG</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Terms</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">How engagements are priced</h2>
            <p className="plan-body mt-4">
              Numbers depend on the brief, but the shape never changes: you see
              the price in writing before anything is committed, and nothing
              bills by the hour.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {engagementShapes.map((shape) => (
                <div key={shape.title} className="ticket">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="plan-data text-[var(--ink-3)]">
                      {shape.code}
                    </p>
                  </div>
                  <h3 className="plan-h3 mt-3">{shape.title}</h3>
                  <p className="plan-label mt-2 text-[var(--key-deep)]">
                    {shape.shape}
                  </p>
                  <p className="plan-body ticket-rule plan-body-sm">
                    {shape.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- FAQ ---- */}
      <Reveal className="rail bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">FAQ</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Asked first</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">Questions we get asked</h2>
            <div className="mt-8 border-t border-[var(--ink)]">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group border-b border-[var(--hair)]"
                >
                  <summary className="plan-h3 flex max-w-3xl cursor-pointer list-none items-center justify-between gap-4 py-4 marker:content-none">
                    {faq.question}
                    <PlanIcon
                      name="cross"
                      size={15}
                      className="text-[var(--ink-2)] transition-transform group-open:rotate-45"
                    />
                  </summary>
                  <p className="plan-body pb-5 plan-body-sm">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- Close ---- */}
      <Reveal className="rail brand-block">
        <div className="bay py-14 md:py-20">
          <div className="bay-code">
            <p
              className="plan-note opacity-70"
              style={{ color: 'var(--key-ink)' }}
            >
              End of bay
            </p>
          </div>
          <div className="min-w-0">
            <h2
              className="plan-h2 rack-target max-w-[20ch]"
              style={{ color: 'var(--key-ink)' }}
            >
              Tell us what the commercial problem actually is.
            </h2>
            <p className="plan-lede mt-6">
              Most engagements start with a business that knows its numbers are
              not where they should be but cannot yet name the reason. That is
              the conversation we are good at. You leave it with a written scope
              and a fixed price, whether or not you go ahead with us.
            </p>
            <div className="ticket mt-9 max-w-md">
              <p className="plan-data text-[var(--ink-3)]">
                NO FEE FOR THE FIRST CONVERSATION
              </p>
              <div className="ticket-rule">
                <Link
                  href={buildMarketingHref('/contact?track=commercial', isLocalhost)}
                  className="flash"
                >
                  Start a conversation
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
