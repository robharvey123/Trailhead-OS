import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
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
  name: string
  status: 'Live' | 'In build'
  sector: string
  summary: string
  origin?: string
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

// One screen, three cards, each linking out to the product's own home. Deep
// product pages on this domain would duplicate the product sites and split
// whatever authority each one earns, so there aren't any.
const products: LabsProduct[] = [
  {
    name: 'Engineer OS',
    status: 'Live',
    sector: 'Field service software',
    summary:
      'Job management for UK field service teams. Offline-capable job sheets, automatic certificates, asset history and invoicing, built for firms the enterprise platforms price out.',
    origin:
      'Started life as BrightFire, a bespoke build for a fire and security contractor in Harlow, and was productised once it proved itself in the field.',
    pricing: 'Per engineer, from £15 a month',
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

      <section className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--marketing-accent)]">
            Trailhead Labs
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-bold tracking-[-0.05em] md:text-[56px]">
            Software we build, sell and run ourselves.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Live products with paying customers, which means we carry the
            support, the billing and the uptime &mdash; the parts of software
            that only show up long after launch. Each one has its own home;
            this page just points the way.
          </p>
        </div>
      </section>

      <Reveal>
        <section className="px-6 pb-16 md:px-8 md:pb-20">
          <div className="mx-auto grid max-w-[1100px] gap-5">
            {products.map((product) => (
              <article
                key={product.name}
                className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-7 md:p-9"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-[-0.03em]">{product.name}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                      product.status === 'Live'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {product.status}
                  </span>
                  <span className="text-sm text-slate-500">{product.sector}</span>
                </div>

                <p className="mt-4 max-w-2xl leading-7 text-slate-600">{product.summary}</p>

                {product.origin ? (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                    {product.origin}
                  </p>
                ) : null}

                {product.pricing ? (
                  <p className="mt-4 text-sm font-semibold text-[var(--marketing-text)]">
                    {product.pricing}
                  </p>
                ) : null}

                <div className="mt-7">
                  {product.external ? (
                    <a
                      href={product.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-full bg-[var(--marketing-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--marketing-accent-strong)]"
                    >
                      {product.ctaLabel}
                    </a>
                  ) : (
                    <Link
                      href={buildMarketingHref(product.href, isLocalhost)}
                      className="inline-flex items-center justify-center rounded-full bg-[var(--marketing-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--marketing-accent-strong)]"
                    >
                      {product.ctaLabel}
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="px-6 pb-16 md:px-8 md:pb-20">
          <div className="mx-auto max-w-[1100px] rounded-[2rem] bg-slate-950 px-8 py-14 text-white md:px-14">
            <h2 className="max-w-2xl text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              None of them quite fit?
            </h2>
            <p className="mt-5 max-w-2xl leading-8 text-slate-300">
              Every one of these started as a specific business with a specific
              problem, and was only productised once it worked. If your
              operation does not fit an off-the-shelf tool, that is a Trailhead
              Studio conversation.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link
                href={buildMarketingHref('/studio', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                See how we build
              </Link>
              <Link
                href={buildMarketingHref('/contact?track=labs', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Start a conversation
              </Link>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  )
}
