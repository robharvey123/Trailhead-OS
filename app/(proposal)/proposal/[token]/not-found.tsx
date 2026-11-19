import Image from 'next/image'
import { COMPANY } from '@/lib/brand'

/** The one response for every bad proposal link, whatever the reason. */
export default function ProposalNotFound() {
  return (
    <main className="thmock flex min-h-screen items-center justify-center bg-[color:var(--surface)] px-4">
      <div className="os-card w-full max-w-md p-8 text-center">
        <Image src="/logo-icon.svg" alt="" width={36} height={36} className="mx-auto mb-5 h-9 w-9" />
        <h1 className="mb-3 font-[family-name:var(--serif)] text-xl font-bold text-[color:var(--text)]">
          This link is no longer active
        </h1>
        <p className="text-sm text-[color:var(--text-2)]">
          Contact{' '}
          <a
            href={`mailto:${COMPANY.email}`}
            className="font-medium text-[color:var(--accent-strong)] underline underline-offset-2 hover:text-[color:var(--accent-hover)]"
          >
            {COMPANY.email}
          </a>{' '}
          and we will send you a fresh one.
        </p>
      </div>
    </main>
  )
}
