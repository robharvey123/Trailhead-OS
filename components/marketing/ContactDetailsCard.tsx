import Link from 'next/link'
import { buildMarketingHref } from '@/lib/site'

interface ContactDetailsCardProps {
  includeLegalNote?: boolean
  isLocalhost: boolean
}

export default function ContactDetailsCard({
  includeLegalNote = false,
  isLocalhost,
}: ContactDetailsCardProps) {
  return (
    <aside className="rounded-[2rem] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-8">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Email
          </p>
          <a
            href="mailto:rob@trailheadholdings.uk"
            className="mt-2 block text-lg font-semibold text-[var(--marketing-text)]"
          >
            rob@trailheadholdings.uk
          </a>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Contact number
          </p>
          <a
            href="tel:+447346808412"
            className="mt-2 block text-lg font-semibold text-[var(--marketing-text)]"
          >
            +44 7346 808412
          </a>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Based in
          </p>
          <p className="mt-2 text-lg text-slate-700">Brentwood, Essex, UK</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Company
          </p>
          <p className="mt-2 text-lg text-slate-700">Trailhead Holdings Ltd</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Registration
          </p>
          <p className="mt-2 text-lg text-slate-700">
            Registered in England &amp; Wales 16910286
          </p>
        </div>
      </div>

      {includeLegalNote ? (
        <p className="mt-8 text-sm leading-6 text-slate-500">
          By contacting us you agree to our{' '}
          <Link href={buildMarketingHref('/privacy', isLocalhost)}>
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href={buildMarketingHref('/terms', isLocalhost)}>
            Terms of Service
          </Link>
          .
        </p>
      ) : null}
    </aside>
  )
}
