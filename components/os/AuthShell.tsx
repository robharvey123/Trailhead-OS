import type { ReactNode } from 'react'
import TrailheadLogo, { TrailheadMark } from '@/components/brand/TrailheadLogo'

/**
 * The frame for every signed-out screen of the OS: sign in, password reset,
 * invite acceptance and account claim.
 *
 * Navy ground with the reverse lockup, the form in a white card, and the large
 * four-bar mark sitting quietly behind it, as the marketing hero does.
 *
 * The outer wrapper carries `.thmock` (tokens) and `.th-dark` (navy remap); the
 * card opts back into the light tokens with `.th-light`, so the form inside
 * uses the same classes as any other OS form.
 */
export default function AuthShell({
  title,
  description,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="thmock th-dark">
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,var(--navy),var(--navy-deep))] px-6 py-12">
        <TrailheadMark
          variant="reverse"
          className="pointer-events-none absolute bottom-0 right-[max(1.5rem,6vw)] h-auto w-[clamp(12rem,32vw,26rem)] opacity-10"
        />
        <div className="relative w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <TrailheadLogo variant="reverse" />
          </div>
          <main className="th-light rounded-card border border-[var(--border)] bg-[var(--bg)] p-8 shadow-[var(--shadow-lg)]">
            <h1 className="os-page-title">{title}</h1>
            {description ? <p className="mt-2 text-sm text-[var(--text-2)]">{description}</p> : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

/** Shared field classes for the auth forms. */
export const authInputClass = 'os-input w-full px-3 py-2.5 text-sm'
export const authLabelClass = 'block text-sm font-medium text-[var(--text)]'
export const authLinkClass = 'font-medium text-[var(--accent-strong)] underline-offset-2 hover:underline'
