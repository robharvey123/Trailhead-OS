import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrailheadLogo from '@/components/brand/TrailheadLogo'
import {
  buildAppLoginHref,
  buildMarketingSiteUrl,
  isLocalDevelopmentHost,
} from '@/lib/site'

export const metadata: Metadata = {
  title: 'Trailhead OS',
  description:
    'Trailhead OS is the operating system for Trailhead Holdings Ltd, bringing together tasks, calendar planning, CRM, enquiries, quotes, invoicing, and client-facing workflows in one place.',
}

const features = [
  'Task management across workstreams and personal admin',
  'Calendar planning with project events and due dates in one view',
  'CRM, enquiries, quotes, and invoicing in a single workspace',
  'Selected client-facing forms and shared operational views',
]

export default async function Home() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="thmock th-dark">
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--navy),var(--navy-deep))]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <TrailheadLogo variant="reverse" />
            <h1 className="border-l border-[var(--border-light)] pl-4 font-[Georgia,serif] text-lg font-bold text-[var(--text)]">
              Trailhead OS
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={buildMarketingSiteUrl('/privacy', isLocalhost)}
              className="text-sm text-[var(--text-2)] transition hover:text-[var(--text)]"
            >
              Privacy Policy
            </Link>
            <Link
              href={buildAppLoginHref(isLocalhost)}
              className="btn btn-ghost"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="px-6 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <section className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--accent-strong)]">
              Business Operating System
            </p>
            <h2 className="mt-5 font-[Georgia,serif] text-4xl font-bold leading-[1.08] tracking-[-0.02em] text-[var(--text)] md:text-5xl">
              Trailhead OS keeps the work of Trailhead Holdings in one place.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-2)]">
              Trailhead OS is the internal operations platform for Trailhead
              Holdings Ltd. It is used to manage day-to-day work across
              projects, personal admin, calendar events, CRM, enquiries,
              quoting, invoicing, and selected client-facing workflows.
            </p>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-2)]">
              The application is designed for operational control rather than
              public sign-up. Clients may interact with specific shared forms or
              views, while authenticated access is reserved for the Trailhead
              Holdings workspace.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href={buildAppLoginHref(isLocalhost)}
                className="btn btn-primary"
              >
                Sign in to Trailhead OS
              </Link>
              <Link
                href={buildMarketingSiteUrl('/', isLocalhost)}
                className="btn btn-ghost"
              >
                Visit trailheadholdings.uk
              </Link>
            </div>
          </section>

          <aside className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[var(--text-3)]">
              What the app covers
            </p>
            <ul className="mt-6 space-y-4">
              {features.map((feature) => (
                <li
                  key={feature}
                  className="rounded-control border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm leading-6 text-[var(--text-2)]"
                >
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-control border border-[var(--accent)]/30 bg-[var(--accent-dim)] p-4">
              <p className="text-sm leading-6 text-[var(--text-2)]">
                Homepage, privacy policy, and product description are publicly
                available here for verification and compliance. Application data
                access remains behind authentication.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-[var(--text-3)] md:flex-row md:items-center md:justify-between">
          <p>Trailhead OS by Trailhead Holdings Ltd</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={buildMarketingSiteUrl('/privacy', isLocalhost)}
              className="transition hover:text-[var(--text)]"
            >
              Privacy Policy
            </Link>
            <Link
              href={buildMarketingSiteUrl('/terms', isLocalhost)}
              className="transition hover:text-[var(--text)]"
            >
              Terms of Service
            </Link>
            <Link
              href={buildMarketingSiteUrl('/contact', isLocalhost)}
              className="transition hover:text-[var(--text)]"
            >
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
    </div>
  )
}
