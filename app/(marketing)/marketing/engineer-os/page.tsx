import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Engineer OS, Job Management for UK Field Service Teams',
  description:
    'Engineer OS is a mobile-first job management platform for UK field service firms. Offline-capable digital job sheets, certificates, assets and invoicing. From £15 per engineer per month.',
  path: '/engineer-os',
  keywords: [
    'field service management software UK',
    'job management software for engineers',
    'offline job sheet app',
    'fire and security service software',
    'engineer certificate software',
  ],
})

const capabilities = [
  {
    title: 'Works with no signal',
    description:
      'Installs to an engineer’s home screen and keeps working in a basement plant room or a lift shaft. Job sheets, photos and signatures are captured locally and sync when the van is back in range.',
  },
  {
    title: 'Forms that produce certificates',
    description:
      'Configurable digital forms with photo capture and drawn signatures, generating a branded PDF certificate automatically. The paperwork is done before the engineer has left the car park.',
  },
  {
    title: 'Assets with their own history',
    description:
      'Every unit on every site carries its own service record. When an insurer asks you to prove a panel was serviced on time, it is one click rather than an afternoon in a filing cabinet.',
  },
  {
    title: 'Renewals before they lapse',
    description:
      'Certificate expiry tracking surfaces upcoming renewals as a reminder rather than a surprise — and as a recurring revenue line rather than a missed one.',
  },
  {
    title: 'Quoting and invoicing',
    description:
      'Quote from the job, invoice from the completed work, and sync both to Xero or QuickBooks instead of retyping them.',
  },
  {
    title: 'The numbers behind the work',
    description:
      'Dashboards for utilisation, SLA performance and job profitability — so you can see which contracts are worth renewing and which engineer is quietly carrying the team.',
  },
]

const architecture = [
  {
    title: 'Offline-first, not offline-tolerant',
    description:
      'A service worker built with Serwist handles precaching and background sync, so the app is a genuine installable PWA rather than a website that shows an error when the signal drops. Writes queue locally and reconcile on reconnect.',
  },
  {
    title: 'Postgres with row-level security',
    description:
      'Supabase provides the database, auth and storage, with row-level security policies enforcing tenant isolation in the database itself rather than in application code — the layer that still holds if a query is written carelessly.',
  },
  {
    title: 'Certificates rendered server-side',
    description:
      'PDFs are generated on the server with React PDF, so a certificate looks identical whether it was produced from a six-year-old Android handset or a desktop in the office.',
  },
  {
    title: 'Rate limiting at the edge',
    description:
      'Upstash Redis backs rate limiting on authentication and public endpoints, which matters once a product is live and on the open internet rather than behind a client VPN.',
  },
  {
    title: 'Billing that matches the pricing',
    description:
      'Stripe handles per-engineer subscriptions, trials and proration, so adding an engineer mid-month bills correctly without anyone doing arithmetic.',
  },
  {
    title: 'Tested before it ships',
    description:
      'Vitest for unit coverage and Playwright for end-to-end journeys across the flows that would cost a customer real money if they broke — job completion, certificate generation, billing.',
  },
]

const stack = [
  'Next.js',
  'TypeScript',
  'Tailwind',
  'Supabase',
  'Serwist (PWA)',
  'Stripe',
  'React PDF',
  'Upstash Redis',
  'Playwright',
  'Vitest',
  'Vercel',
]

export default async function EngineerOsPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
      <section className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
              Engineer OS
            </p>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
              Live
            </span>
          </div>

          <h1 className="mt-5 max-w-3xl text-5xl font-bold tracking-[-0.05em] md:text-[56px]">
            Job management for field service teams that were priced out of the
            enterprise stuff.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Small field service firms run on a mix of WhatsApp groups, Word
            templates and a filing cabinet. The work is rarely the hard part.
            Proving it happened, on time, to whoever is asking, is what costs
            them. Engineer OS is built for those firms specifically — not scaled
            down from something designed for a fleet ten times the size.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="https://engineeros.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-sky-700 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-800"
            >
              Visit engineeros.uk
            </a>
            <Link
              href={buildMarketingHref('/contact', isLocalhost)}
              className="inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] px-6 py-3.5 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-sky-300 hover:bg-sky-50"
            >
              Talk to us about a build
            </Link>
          </div>

          <p className="mt-8 text-sm leading-7 text-slate-600">
            Per-engineer pricing from <strong className="font-semibold text-[var(--marketing-text)]">£15 a month</strong>,
            with a 14-day trial and same-day setup. A typical ten-engineer team
            is onboarded inside a week, customer data imported and existing forms
            rebuilt as part of the setup.
          </p>
        </div>
      </section>

      <Reveal>
        <section className="border-t border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              What it does
            </h2>
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
            <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              How it is built
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600">
              Worth reading if you are weighing us up for a build of your own.
              These are the decisions that determine whether a field product
              survives contact with a real van on a real Tuesday.
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
        <section className="border-t border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              Where it came from
            </h2>
            <div className="mt-6 max-w-3xl space-y-5 text-lg leading-8 text-slate-600">
              <p>
                Engineer OS started as a bespoke build for Bright Fire Services,
                a fire and security contractor in Harlow. They were tracking jobs
                across a WhatsApp group, a Word template and a shared drive, and
                retyping certificates in the office from paper brought back off
                site.
              </p>
              <p>
                The build worked well enough that we productised it and took it
                to market. That is the honest version of this product’s history,
                and the clearest evidence we know how to design software for a
                trade rather than for a demo.
              </p>
            </div>
            <Link
              href={buildMarketingHref('/bright-fire', isLocalhost)}
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:text-sky-900"
            >
              Read the BrightFire story
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="px-6 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-[1100px] rounded-[2rem] bg-slate-950 px-8 py-14 text-white md:px-14">
            <h2 className="max-w-2xl text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              Want the product, or something like it for your own trade?
            </h2>
            <p className="mt-5 max-w-2xl leading-8 text-slate-300">
              If you run a field service team, Engineer OS is ready to use today.
              If your operation does not fit it, that is usually a build — and
              this product is what our builds look like a year after launch.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <a
                href="https://engineeros.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Visit engineeros.uk
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
