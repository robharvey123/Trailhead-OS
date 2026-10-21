'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/sales/dashboard', label: 'Dashboard' },
  { href: '/sales/contacts', label: 'Contacts' },
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
    <div className="min-h-screen bg-[var(--bg)] text-[color:var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/sales/dashboard" className="text-sm font-semibold tracking-tight">
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
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    active
                      ? 'bg-[var(--surface-2)] font-medium text-[color:var(--text)]'
                      : 'text-[color:var(--text-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm text-[color:var(--text-2)]">
            {isOwnerView ? (
              <Link href="/dashboard" className="hover:text-[color:var(--text)]">Back to OS</Link>
            ) : null}
            {displayName ? <span className="hidden sm:inline">{displayName}</span> : null}
            <button type="button" onClick={signOut} className="rounded-lg px-2 py-1 hover:bg-[var(--surface-2)]">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
