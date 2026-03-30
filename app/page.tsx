import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-sky-300">
              Trailhead Holdings Ltd
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
              Trailhead OS
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={buildMarketingSiteUrl('/privacy', isLocalhost)}
              className="text-sm text-slate-300 transition hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              href={buildAppLoginHref(isLocalhost)}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="px-6 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <section className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-300">
              Business Operating System
            </p>
            <h2 className="mt-6 text-5xl font-bold leading-[1.02] tracking-[-0.05em] text-white md:text-6xl">
              Trailhead OS keeps the work of Trailhead Holdings in one place.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Trailhead OS is the internal operations platform for Trailhead
              Holdings Ltd. It is used to manage day-to-day work across
              projects, personal admin, calendar events, CRM, enquiries,
              quoting, invoicing, and selected client-facing workflows.
            </p>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              The application is designed for operational control rather than
              public sign-up. Clients may interact with specific shared forms or
              views, while authenticated access is reserved for the Trailhead
              Holdings workspace.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href={buildAppLoginHref(isLocalhost)}
                className="rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
              >
                Sign in to Trailhead OS
              </Link>
              <Link
                href={buildMarketingSiteUrl('/', isLocalhost)}
                className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Visit trailheadholdings.uk
              </Link>
            </div>
          </section>

          <aside className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-8 shadow-[0_30px_80px_-45px_rgba(14,165,233,0.35)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              What the app covers
            </p>
            <ul className="mt-6 space-y-4">
              {features.map((feature) => (
                <li
                  key={feature}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-sm leading-6 text-slate-200"
                >
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
              <p className="text-sm leading-6 text-sky-100">
                Homepage, privacy policy, and product description are publicly
                available here for verification and compliance. Application data
                access remains behind authentication.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-800 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>Trailhead OS by Trailhead Holdings Ltd</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={buildMarketingSiteUrl('/privacy', isLocalhost)}
              className="transition hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              href={buildMarketingSiteUrl('/terms', isLocalhost)}
              className="transition hover:text-white"
            >
              Terms of Service
            </Link>
            <Link
              href={buildMarketingSiteUrl('/contact', isLocalhost)}
              className="transition hover:text-white"
            >
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
