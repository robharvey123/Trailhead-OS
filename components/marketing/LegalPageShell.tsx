import Link from 'next/link'
import type { ReactNode } from 'react'
import Reveal from '@/components/marketing/Reveal'
import { buildMarketingHref } from '@/lib/site'

interface LegalPageShellProps {
  children: ReactNode
  isLocalhost: boolean
}

export default function LegalPageShell({
  children,
  isLocalhost,
}: LegalPageShellProps) {
  return (
    <Reveal className="px-6 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-[720px]">
        <Link
          href={buildMarketingHref('/', isLocalhost)}
          className="inline-flex items-center text-sm font-semibold text-sky-600 transition hover:text-sky-700"
        >
          ← Back to home
        </Link>

        <article className="mt-8 text-[1.02rem] leading-8 text-slate-700 [overflow-wrap:anywhere] [&_a]:text-sky-600 [&_a]:underline [&_a]:underline-offset-4">
          {children}
        </article>
      </div>
    </Reveal>
  )
}
