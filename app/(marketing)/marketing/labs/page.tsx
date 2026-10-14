import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import PlanIcon from '@/components/marketing/PlanIcon'
import PlateSlot from '@/components/marketing/PlateSlot'
import Reveal from '@/components/marketing/Reveal'
import { BreadcrumbJsonLd, SoftwareApplicationJsonLd } from '@/components/JsonLd'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { absoluteUrl, buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Trailhead Labs',
  description:
    'The software products Trailhead builds, sells and runs: Engineer OS for UK field service teams, MVP Cricket for grassroots clubs, and MVP Predictor.',
  path: '/labs',
  // Labs chases no keyword pool of its own. Each product's own domain is the
  // canonical home, and this page just routes to them.
  keywords: ['Trailhead Labs', 'Engineer OS', 'MVP Cricket', 'MVP Predictor'],
})

type LabsProduct = {
  code: string
  name: string
  status: 'Live' | 'In build'
  sector: string
  summary: string
  /** Real product screenshot. See .impeccable/ASSETS.md; omitted until supplied. */
  screenshot?: string
  screenshotAlt?: string
  origin?: string
  /** The shelf price. `null` means not set yet, and prints as exactly that. */
  pricing: string | null
  href: string
  external: boolean
  ctaLabel: string
  jsonLd: {
    description: string
    url: string
    applicationCategory: string
    price?: { amount: string; currency: string; unitText: string }
  }
}

// One screen, three facings, each linking out to the product's own home. Deep
// product pages on this domain would duplicate the product sites and split
// whatever authority each one earns, so there aren't any.
const products: LabsProduct[] = [
  {
    code: 'LAB-01',
    name: 'Engineer OS',
    status: 'Live',
    sector: 'Field service software',
    summary:
      'Job management for UK field service teams. Offline-capable job sheets, automatic certificates, asset history and invoicing, built for firms the enterprise platforms price out.',
    origin:
      'Started life as BrightFire, a bespoke build for a fire and security contractor in Harlow, and was productised once it proved itself in the field.',
    pricing: 'From £15 per engineer, per month',
    screenshot: '/labs/engineer-os.webp',
    screenshotAlt:
      "Engineer OS on a phone: an engineer's day of scheduled jobs, each with its reference, customer and time",
    href: 'https://engineeros.uk',
    external: true,
    ctaLabel: 'Visit engineeros.uk',
    jsonLd: {
      description:
        'Job management software for UK field service teams: offline job sheets, automatic certificates, asset history and invoicing.',
      url: 'https://engineeros.uk',
      applicationCategory: 'BusinessApplication',
      price: { amount: '15', currency: 'GBP', unitText: 'per engineer per month' },
    },
  },
  {
    code: 'LAB-02',
    name: 'MVP Cricket',
    status: 'Live',
    sector: 'Sports SaaS',
    summary:
      'Multi-tenant club management for grassroots cricket. Play-Cricket sync, automated MVP scoring, leaderboards and member notifications, run by volunteers rather than administrators.',
    origin:
      'Built and battle-tested at Brookweald CC. A full season of fixtures, selections, published team sheets and match-fee collection ran on it before the product opened its doors: 40+ members, £7,000+ in match fees collected.',
    screenshot: '/labs/mvp-cricket.webp',
    screenshotAlt:
      'MVP Cricket on a phone: the club MVP leaderboard for the 2026 season, players ranked by points across matches played',
    pricing: 'Free leaderboard, then from £9.99 a month',
    href: 'https://mvpcricket.app',
    external: true,
    ctaLabel: 'Visit mvpcricket.app',
    jsonLd: {
      description:
        'Club management software for grassroots cricket: Play-Cricket sync, automated MVP scoring, leaderboards and member notifications.',
      url: 'https://mvpcricket.app',
      applicationCategory: 'SportsApplication',
      // The Club plan; the leaderboard-only plan is free.
      price: { amount: '9.99', currency: 'GBP', unitText: 'per club per month' },
    },
  },
  {
    code: 'LAB-03',
    name: 'MVP Predictor',
    status: 'In build',
    sector: 'Sports SaaS',
    summary:
      'White-label Premier League prediction competitions for clubs. Clubs pay a flat subscription, members predict, and the entry money never touches the platform.',
    pricing: null,
    href: '/labs/mvp-predictor',
    external: false,
    ctaLabel: 'How it works',
    jsonLd: {
      description:
        'White-label football prediction competitions for clubs, run on a flat club subscription.',
      url: absoluteUrl('/labs/mvp-predictor'),
      applicationCategory: 'SportsApplication',
    },
  },
]

// Side by side, from each product's own pricing page (checked 14 Oct 2026).
// If a product site changes its prices, this table and the facings above
// change with it.
const atAGlance: Array<{ name: string; forWho: string; pricing: string; start: string }> = [
  {
    name: 'Engineer OS',
    forWho: 'UK field service teams of 5 to 100 engineers',
    pricing: '£15, £25 or £40 per engineer a month by plan. Admins free. 20% off annual.',
    start: '14-day trial, no card. A live demo opens without a form.',
  },
  {
    name: 'MVP Cricket',
    forWho: 'Volunteer-run grassroots cricket clubs',
    pricing: 'Leaderboard free forever. Club £9.99 a month or £99 a year. Premier £19.99 a month or £199 a year.',
    start: 'Start on the free plan and upgrade when the season needs it.',
  },
  {
    name: 'MVP Predictor',
    forWho: 'Clubs running a Premier League prediction competition',
    pricing: 'A flat club subscription, published before launch.',
    start: 'Register interest; not yet taking competitions.',
  },
]

// Where each product came from. The pattern is the reason Labs exists.
const origins = [
  {
    step: 'Built for one business',
    detail: 'Each product starts as a bespoke build for a real operation with a real problem: a fire and security contractor, a cricket club, a club committee running a World Cup prediction competition.',
  },
  {
    step: 'Proved in the field',
    detail: 'It runs that business for long enough to show it works: a full cricket season, a whole tournament, live jobs on engineers’ phones.',
  },
  {
    step: 'Opened to everyone',
    detail: 'Only then is it rebuilt as a product other businesses can sign up to, with its own site, its own pricing and its own support.',
  },
]

export default async function LabsPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
      <BreadcrumbJsonLd items={[{ name: 'Labs', path: '/labs' }]} />
      {products.map((product) => (
        <SoftwareApplicationJsonLd
          key={`jsonld-${product.name}`}
          name={product.name}
          description={product.jsonLd.description}
          url={product.jsonLd.url}
          applicationCategory={product.jsonLd.applicationCategory}
          price={product.jsonLd.price}
        />
      ))}

      {/* ---- Hero ---- */}
      <section className="pt-10 pb-10 md:pt-16 md:pb-12">
        <div className="bay">
          <div className="bay-code hidden lg:block">
            <p className="plan-data text-[var(--ink-3)]">BAY 03</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Labs</p>
          </div>
          <div className="min-w-0">
            <h1 className="plan-display rack max-w-[15ch]">
              Software we build, sell and run ourselves.
            </h1>
            <p className="plan-lede mt-7">
              Live products with paying customers, which means we carry the
              support, the billing and the uptime, the parts of software that
              only show up long after launch. Each one has its own home;
              this page just points the way.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Three facings, each with its real shelf price ---- */}
      <Reveal className="rail">
        <div className="bay py-10 md:py-14">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">LAB</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">3 facings</p>
          </div>
          <div className="min-w-0">
            <div className="facings md:grid-cols-3">
              {products.map((product) => (
                <article
                  key={product.name}
                  className="facing flex flex-col bg-[var(--plan)]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="plan-data text-[var(--ink-3)]">
                      {product.code}
                    </p>
                    <span
                      className={`key-state ${
                        product.status === 'Live' ? 'key-live' : 'key-build'
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>

                  <h2 className="plan-h3 mt-4">{product.name}</h2>
                  <p className="plan-data mt-2 text-[var(--ink-3)]">
                    {product.sector.toUpperCase()}
                  </p>

                  <p className="plan-body mt-4 flex-1 plan-body-sm">
                    {product.summary}
                  </p>

                  {product.origin ? (
                    <p className="plan-body mt-3 border-l border-[var(--hair)] pl-3 plan-body-xs">
                      {product.origin}
                    </p>
                  ) : null}

                  <PlateSlot
                    src={product.screenshot}
                    alt={product.screenshotAlt ?? `${product.name} in use`}
                    width={418}
                    height={849}
                    className="mt-5 max-w-[13rem]"
                    sizes="13rem"
                  />

                  {/* The shelf ticket: the price is the point of a ticket, so
                      an unset price prints as unset rather than disappearing. */}
                  <div className="ticket mt-6">
                    <p className="plan-data text-[var(--ink-3)]">PRICE</p>
                    <p
                      className="mt-1 text-[1.0625rem] font-bold text-[var(--ink)]"
                      style={{ fontStretch: '84%' }}
                    >
                      {product.pricing ?? 'Not set, in build'}
                    </p>
                    <div className="ticket-rule">
                      {product.external ? (
                        <a
                          href={product.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flash w-full justify-between"
                        >
                          {product.ctaLabel}
                          <PlanIcon name="external" />
                        </a>
                      ) : (
                        <Link
                          href={buildMarketingHref(product.href, isLocalhost)}
                          className="flash w-full justify-between"
                        >
                          {product.ctaLabel}
                          <PlanIcon name="right" />
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- At a glance ---- */}
      <Reveal className="rail bg-[var(--plan-recess)]">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">TERMS</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">Side by side</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">The three, side by side</h2>
            <div className="mt-8 border-t border-[var(--ink)]">
              {atAGlance.map((row) => (
                <div
                  key={row.name}
                  className="grid gap-x-8 gap-y-2 border-b border-[var(--hair)] py-5 md:grid-cols-[10rem_repeat(3,minmax(0,1fr))]"
                >
                  <h3 className="plan-h3">{row.name}</h3>
                  <div>
                    <p className="plan-data text-[var(--ink-3)]">FOR</p>
                    <p className="plan-body mt-1 plan-body-sm">{row.forWho}</p>
                  </div>
                  <div>
                    <p className="plan-data text-[var(--ink-3)]">PRICING</p>
                    <p className="plan-body mt-1 plan-body-sm">{row.pricing}</p>
                  </div>
                  <div>
                    <p className="plan-data text-[var(--ink-3)]">TO START</p>
                    <p className="plan-body mt-1 plan-body-sm">{row.start}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="plan-body mt-4 plan-body-xs">
              Engineer OS prices exclude VAT. Each product&rsquo;s own site has
              the current plans and the full feature list.
            </p>
          </div>
        </div>
      </Reveal>

      {/* ---- How a product gets here ---- */}
      <Reveal className="rail">
        <div className="bay py-12 md:py-16">
          <div className="bay-code">
            <p className="plan-data text-[var(--ink-3)]">ORIGIN</p>
            <p className="plan-note mt-1 text-[var(--ink-3)]">3 stages</p>
          </div>
          <div className="min-w-0">
            <h2 className="plan-h2 rack-target">How a product gets here</h2>
            <p className="plan-body mt-4">
              None of these started as a gap spotted in a market report. Each
              one followed the same three steps.
            </p>
            <ol className="facings mt-8 md:grid-cols-3">
              {origins.map((origin, index) => (
                <li key={origin.step} className="facing">
                  <p className="plan-data text-[var(--ink-3)]">
                    STAGE {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="plan-h3 mt-3">{origin.step}</h3>
                  <p className="plan-body mt-3 plan-body-sm">{origin.detail}</p>
                </li>
              ))}
            </ol>
            <p className="plan-body mt-8">
              <span className="key-state key-live mr-2">Live</span> means a
              product is running with paying customers, and we carry its
              support, billing and uptime.{' '}
              <span className="key-state key-build mx-2">In build</span> means it
              is real work in progress, not yet taking customers.
            </p>
          </div>
        </div>
      </Reveal>

      {/* ---- Close ---- */}
      <Reveal className="rail brand-block">
        <div className="bay py-14 md:py-20">
          <div className="bay-code">
            <p className="plan-note opacity-70" style={{ color: 'var(--key-ink)' }}>
              End of bay
            </p>
          </div>
          <div className="min-w-0">
            <h2
              className="plan-h2 rack-target max-w-[16ch]"
              style={{ color: 'var(--key-ink)' }}
            >
              None of them quite fit?
            </h2>
            <p className="plan-lede mt-6">
              Every one of these started as a specific business with a specific
              problem, and was only productised once it worked. If your
              operation does not fit an off-the-shelf tool, that is a Trailhead
              Studio conversation.
            </p>
            <div className="ticket mt-9 max-w-md">
              <p className="plan-data text-[var(--ink-3)]">
                BESPOKE · BUILT BY THE PERSON WHO SCOPED IT
              </p>
              <div className="ticket-rule flex flex-col gap-2">
                <Link
                  href={buildMarketingHref('/studio', isLocalhost)}
                  className="flash"
                >
                  See how we build
                  <PlanIcon name="right" />
                </Link>
                <Link
                  href={buildMarketingHref('/contact?track=labs', isLocalhost)}
                  className="flash-ghost justify-center"
                >
                  Start a conversation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
