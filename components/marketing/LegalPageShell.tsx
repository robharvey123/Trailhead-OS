import Link from 'next/link'
import type { ReactNode } from 'react'
import PlanIcon from '@/components/marketing/PlanIcon'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref } from '@/lib/site'

interface LegalPageShellProps {
  children: ReactNode
  isLocalhost: boolean
}

/**
 * The small print on the back of the ticket: one narrow measure, ruled
 * headings, nothing else competing. Long-form legal copy is read for a single
 * clause, so the type stays at reading size and every heading sits on a rule.
 */
export default function LegalPageShell({
  children,
  isLocalhost,
}: LegalPageShellProps) {
  return (
    <Reveal>
      <div className="pt-8 pb-16 md:pt-12 md:pb-20">
        <div className="bay">
          <div className="bay-code bay-code-lead">
            <Link
              href={buildMarketingHref('/', isLocalhost)}
              className="plan-label inline-flex items-center gap-2 text-[var(--ink-2)] transition-colors hover:text-[var(--flash)]"
            >
              <PlanIcon name="left" size={13} />
              Back to home
            </Link>
            <div className="mt-6 border-t border-[var(--hair)] pt-3">
              <p className="plan-note text-[var(--ink-3)]">
                Trailhead Holdings Ltd
              </p>
              <p className="plan-data mt-2 text-[var(--ink-3)]">
                ENGLAND &amp; WALES
                <br />
                16910286
              </p>
            </div>
          </div>

          <article className="marketing-prose min-w-0 [overflow-wrap:anywhere]">
            {children}
          </article>
        </div>
      </div>
    </Reveal>
  )
}
