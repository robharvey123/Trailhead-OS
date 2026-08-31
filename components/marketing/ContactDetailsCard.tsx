import Link from 'next/link'
import { buildMarketingHref } from '@/lib/site'

interface ContactDetailsCardProps {
  includeLegalNote?: boolean
  isLocalhost: boolean
}

/**
 * The registration block: the printed facts a buyer checks before they reply.
 * Set as data on ticket stock, in the order someone verifying a company reads
 * them — reach first, then who and where, then the number they can look up.
 */
const details: Array<[string, string]> = [
  ['BASED IN', 'Brentwood, Essex, UK'],
  ['COMPANY', 'Trailhead Holdings Ltd'],
  ['REGISTRATION', 'England & Wales 16910286'],
]

export default function ContactDetailsCard({
  includeLegalNote = false,
  isLocalhost,
}: ContactDetailsCardProps) {
  return (
    <aside className="ticket">
      <p className="plan-data text-[var(--ink-3)]">DIRECT</p>

      <div className="ticket-rule">
        <a
          href="mailto:info@trailheadholdings.uk"
          className="block text-[1.0625rem] font-bold text-[var(--ink)] transition-colors hover:text-[var(--flash)]"
          style={{ fontStretch: '86%' }}
        >
          info@trailheadholdings.uk
        </a>
        <a
          href="tel:+447346808412"
          className="mt-1.5 block text-[1.0625rem] font-bold text-[var(--ink)] transition-colors hover:text-[var(--flash)]"
          style={{ fontStretch: '86%' }}
        >
          +44 7346 808412
        </a>
      </div>

      <dl className="mt-5 border-t border-[var(--hair)]">
        {details.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--hair)] py-2.5"
          >
            <dt className="plan-data text-[var(--ink-3)]">{label}</dt>
            <dd className="plan-body-xs text-[var(--ink)]">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="plan-data mt-5 text-[var(--ink-3)]">
        REPLIES WITHIN 24 HOURS · UK HOURS
      </p>

      {includeLegalNote ? (
        <p className="plan-body plan-body-xs mt-5 border-t border-[var(--hair)] pt-3 leading-relaxed">
          By contacting us you agree to our{' '}
          <Link
            href={buildMarketingHref('/privacy', isLocalhost)}
            className="text-[var(--ink)] underline decoration-[var(--flash)] decoration-2 underline-offset-2"
          >
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link
            href={buildMarketingHref('/terms', isLocalhost)}
            className="text-[var(--ink)] underline decoration-[var(--flash)] decoration-2 underline-offset-2"
          >
            Terms of Service
          </Link>
          .
        </p>
      ) : null}
    </aside>
  )
}
