'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import TrailheadLogo from '@/components/brand/TrailheadLogo'

const NAV = [
  { href: '/sales/dashboard', label: 'Dashboard' },
  { href: '/sales/queue', label: 'Queue' },
  { href: '/sales/pipeline', label: 'Pipeline' },
  { href: '/sales/contacts', label: 'Contacts' },
  { href: '/sales/settings', label: 'Settings' },
]

/**
 * Shell for the Sales Lead seat. Deliberately not OsShell: it loads none of the
 * OS badge counts (tasks, mail, enquiries, quotes) and links nowhere outside
 * /sales. Owners/admins see a "Back to OS" link.
 */
export default function SalesShell({
  displayName,
  isOwnerView,
  children,
}: {
  displayName: string | null
  isOwnerView: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="sales-shell min-h-screen bg-[var(--surface)] text-[color:var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/sales/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <TrailheadLogo variant="positive" markOnly size={24} />
            Trailhead OS <span className="text-[color:var(--text-3)]">· Sales</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1" aria-label="Sales">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`tap inline-flex items-center rounded-control px-3 py-1.5 text-sm transition ${
                    active
                      ? 'bg-[var(--accent-dim)] font-semibold text-[color:var(--accent-strong)]'
                      : 'text-[color:var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[color:var(--text)]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm text-[color:var(--text-2)]">
            {isOwnerView ? (
              <Link href="/dashboard" className="tap inline-flex items-center hover:text-[color:var(--text)]">Back to OS</Link>
            ) : null}
            {displayName ? <span className="hidden sm:inline">{displayName}</span> : null}
            <button type="button" onClick={signOut} className="tap rounded-control px-2 py-1 hover:bg-[var(--surface-2)]">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
