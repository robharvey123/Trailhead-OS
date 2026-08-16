import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Products',
  description:
    'Software products built and run by Trailhead Holdings: Engineer OS for UK field service teams and MVP Cricket for grassroots cricket clubs.',
  path: '/products',
  keywords: [
    'Engineer OS',
    'MVP Cricket',
    'UK SaaS products',
    'field service software',
    'cricket club software',
  ],
})

type Product = {
  name: string
  status: 'Live' | 'In build'
  sector: string
  summary: string
  pricing: string | null
  href: string
  external: string | null
  externalLabel: string | null
}

const products: Product[] = [
  {
    name: 'Engineer OS',
    status: 'Live',
    sector: 'Field service software',
    summary:
      'Job management for UK field service teams. Offline-capable job sheets, automatic certificates, asset history and invoicing — built for firms the enterprise platforms price out.',
    pricing: 'Per engineer, from £15 a month',
    href: '/engineer-os',
    external: 'https://engineeros.uk',
    externalLabel: 'engineeros.uk',
  },
  {
    name: 'MVP Cricket',
    status: 'Live',
    sector: 'Sports SaaS',
    summary:
      'Multi-tenant club management for grassroots cricket. Play-Cricket sync, automated MVP scoring, leaderboards and member notifications, run by volunteers rather than administrators.',
    pricing: 'Tiered, from £19 a month',
    href: '/mvp-cricket',
    external: 'https://mvpcricket.app',
    externalLabel: 'mvpcricket.app',
  },
  {
    name: 'BrightFire',
    status: 'Live',
    sector: 'Fire & security',
    summary:
      'The bespoke build that became Engineer OS. Made for a fire and security contractor in Harlow, productised once it proved itself in the field.',
    pricing: null,
    href: '/bright-fire',
    external: null,
    externalLabel: null,
  },
]

export default async function ProductsPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
      <section className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
            Products
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-bold tracking-[-0.05em] md:text-[56px]">
            Software we built, sell and run ourselves.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            These are not case studies. They are live products with paying
            customers, which means we carry the support, the billing and the
            uptime — the parts of software that only show up after launch. It is
            also the most honest answer to whether we can build something that
            lasts.
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

                {product.pricing ? (
                  <p className="mt-4 text-sm font-semibold text-[var(--marketing-text)]">
                    {product.pricing}
                  </p>
                ) : null}

                <div className="mt-7 flex flex-col gap-4 sm:flex-row">
                  <Link
                    href={buildMarketingHref(product.href, isLocalhost)}
                    className="inline-flex items-center justify-center rounded-full bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800"
                  >
                    How it works
                  </Link>
                  {product.external ? (
                    <a
                      href={product.external}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] px-5 py-3 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
                    >
                      Visit {product.externalLabel}
                    </a>
                  ) : null}
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
              Both of these started as a specific business with a specific
              problem, and were only productised once they worked. If your
              operation does not fit an off-the-shelf tool, that is the
              conversation we are good at.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link
                href={buildMarketingHref('/web-app-design', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                See how we build
              </Link>
              <Link
                href={buildMarketingHref('/contact', isLocalhost)}
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
