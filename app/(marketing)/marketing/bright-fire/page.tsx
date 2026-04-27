import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'BrightFire, Field Service Software for SMEs',
  description:
    'BrightFire is a custom field service platform built by Trailhead. An example of what we ship for service businesses that have outgrown spreadsheets.',
  path: '/bright-fire',
  keywords: [
    'field service software UK',
    'field service management SME',
    'bespoke field service app',
    'custom job management software',
  ],
})

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

const whatThisShowcases = [
  {
    title: 'PWA for field teams',
    description:
      'Every screen is optimised for mobile. Engineers access their jobs, complete forms, and capture photos from the same interface whether they are online or offline.',
  },
  {
    title: 'Offline-first architecture',
    description:
      'Jobs sync locally and update the server automatically when connectivity returns. No data loss on poor signal — a common requirement for field service and construction businesses.',
  },
  {
    title: 'Configurable workflows',
    description:
      'Job sheet templates, checklists, and field types are configurable per client without code changes. This is the kind of flexibility we build into every bespoke tool we deliver.',
  },
  {
    title: 'Real-time dispatch and calendar',
    description:
      'Office teams see live job status and engineer availability. Scheduling changes push instantly to field devices. This is a pattern we use across client portals and operational dashboards.',
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
              An example of what we build for field service businesses.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              BrightFire is a bespoke progressive web app we developed for fire &amp; security,
              electrical, HVAC, and facilities management operations. It is not a
              subscription product — it is a showcase of the kind of tool we design
              and build for clients who have outgrown generic software.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href={buildMarketingHref('/#contact', isLocalhost)}
                className="inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Build something like this
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
            What&apos;s inside
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
            What this showcases
          </p>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            BrightFire demonstrates patterns and capabilities we apply across client builds. Here is what this project illustrates we can deliver.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {whatThisShowcases.map((item) => (
              <article
                key={item.title}
                className="rounded-[2rem] border border-[var(--marketing-border)] bg-white p-8 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.35)]"
              >
                <h2 className="text-2xl font-bold tracking-[-0.03em]">
                  {item.title}
                </h2>
                <p className="mt-4 text-[0.98rem] leading-8 text-slate-600">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="bg-slate-950 px-6 py-20 text-white md:px-8 md:py-24">
        <div className="mx-auto max-w-[1100px] text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-300">
            Want something like this?
          </p>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
            We build tools like BrightFire for clients.
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-400">
            If your operation is running on a mix of spreadsheets, phone calls,
            and software that was never quite designed for how you work, we can
            build you something that fits properly. Tell us what you need.
          </p>
          <Link
            href={buildMarketingHref('/#contact', isLocalhost)}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-400"
          >
            Start a project
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
