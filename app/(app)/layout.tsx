import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/sell-in', label: 'Sell In' },
  { href: '/sell-out', label: 'Sell Out' },
  { href: '/promo', label: 'Promo' },
  { href: '/pnl', label: 'P&L' },
  { href: '/comparison', label: 'Comparison' },
  { href: '/sku-summary', label: 'SKU Summary' },
  { href: '/company-summary', label: 'Company Summary' },
  { href: '/company-sku-detail', label: 'Company SKU Detail' },
  { href: '/settings', label: 'Settings' },
  { href: '/imports', label: 'Imports' },
]

export default async function AppLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-64 flex-col gap-6 border-r border-slate-800 bg-slate-950/80 px-6 py-8 md:flex">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Workspace
          </p>
          <h2 className="mt-2 text-lg font-semibold">Rush Analytics</h2>
        </div>
        <nav className="flex flex-col gap-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-slate-300 transition hover:bg-slate-900 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action="/logout" method="post" className="mt-auto">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </aside>
      <div className="flex-1 px-6 py-8 md:px-10">
        <div className="mb-6 flex items-center justify-between md:hidden">
          <span className="text-sm font-semibold">Rush Analytics</span>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300"
            >
              Sign out
            </button>
          </form>
        </div>
        {children}
      </div>
    </div>
  )
}
