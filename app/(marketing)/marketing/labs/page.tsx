import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import PlanIcon from '@/components/marketing/PlanIcon'
import PlateSlot from '@/components/marketing/PlateSlot'
import Reveal from '@/components/marketing/Reveal'
import { SoftwareApplicationJsonLd } from '@/components/JsonLd'
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
    pricing: 'Tiered, from £19 a month',
    href: 'https://mvpcricket.app',
    external: true,
    ctaLabel: 'Visit mvpcricket.app',
    jsonLd: {
      description:
        'Club management software for grassroots cricket: Play-Cricket sync, automated MVP scoring, leaderboards and member notifications.',
      url: 'https://mvpcricket.app',
      applicationCategory: 'SportsApplication',
      price: { amount: '19', currency: 'GBP', unitText: 'per club per month' },
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

export default async function LabsPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
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

                  <PlateSlot
                    src={product.screenshot}
                    alt={`${product.name} in use`}
                    width={1600}
                    height={1000}
                    className="mt-4"
                  />

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
