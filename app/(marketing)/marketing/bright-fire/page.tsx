import Link from 'next/link'
import { headers } from 'next/headers'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'

const features = [
  {
    title: 'Job scheduling',
    description:
      'Plan and dispatch jobs from a calendar view. Field engineers get instant notification of new assignments and live schedule updates throughout the day.',
  },
  {
    title: 'Digital job sheets',
    description:
      'Replace paper forms with configurable digital checklists. Engineers complete job sheets on their phone or tablet, with photo capture and signature collection built in.',
  },
  {
    title: 'Offline capability',
    description:
      'BrightFire is a PWA that works without a signal. All data syncs automatically when connectivity returns. No lost records, no gaps in job history.',
  },
  {
    title: 'Customer and site records',
    description:
      'Full history per customer and site. Job notes, previous service records, asset details, and contact information all in one place and accessible in the field.',
  },
]

const pricing = [
  {
    name: 'Starter',
    price: '£29/mo',
    description:
      'For small field service teams getting started with digital job management and scheduling.',
  },
  {
    name: 'Pro',
    price: '£69/mo',
    description:
      'For growing operations needing scheduling, digital forms, photo capture, and customer records in one platform.',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description:
      'For larger field service businesses with complex workflows, multi-team operations, and bespoke integration requirements.',
  },
]

const brightFireJobs = [
  ['#2048', 'Fire Alarm Inspection', '09:00', 'J. Cooper', 'active'],
  ['#2049', 'HVAC Annual Service', '11:30', 'T. Marsh', 'scheduled'],
  ['#2050', 'Emergency Lighting Test', '14:00', 'S. White', 'scheduled'],
]

export default async function BrightFirePage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div>
      <section className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-500">
              BrightFire
            </p>
            <h1 className="mt-5 text-5xl font-bold tracking-[-0.05em] md:text-[56px]">
              Field service management for teams that work in the real world.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              BrightFire is a progressive web app built for fire &amp; security,
              electrical, HVAC, and facilities management businesses. Job
              scheduling, digital job sheets, offline capability, and real-time
              field-to-office sync.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href={buildMarketingHref('/#contact', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Get early access
              </Link>
              <Link
                href={buildMarketingHref('/#contact', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full border border-[var(--marketing-border)] px-6 py-3.5 text-sm font-semibold text-[var(--marketing-text)] transition hover:border-orange-300 hover:bg-orange-50"
              >
                Talk to us
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-orange-100 bg-[linear-gradient(180deg,#FFF7ED_0%,#FFEDD5_100%)] p-6">
            <div className="rounded-[1.75rem] border border-orange-50 bg-white p-5 shadow-[0_20px_60px_-40px_rgba(249,115,22,0.35)]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                    Today&apos;s jobs
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                    Field schedule
                  </h2>
                </div>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  27 Apr
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {brightFireJobs.map(([id, title, time, engineer, status]) => (
                  <div
                    key={id}
                    className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3"
                  >
                    <span className="text-xs font-semibold text-orange-500">{id}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{title}</p>
                      <p className="text-xs text-slate-500">
                        {time} · {engineer}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {status === 'active' ? 'Active' : 'Scheduled'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Reveal className="bg-[var(--marketing-surface)] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-500">
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
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-500">
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
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-300">
            Currently in development
          </p>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            Want early access or have a project in mind?
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-400">
            BrightFire is actively being developed. Get in touch if you want to
            follow progress, explore a pilot, or discuss a bespoke build for
            your operation.
          </p>
          <Link
            href={buildMarketingHref('/#contact', isLocalhost)}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-400"
          >
            Get in touch
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
