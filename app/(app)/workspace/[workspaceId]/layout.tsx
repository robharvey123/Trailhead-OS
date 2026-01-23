import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const navItems = [
  { slug: 'dashboard', label: 'Dashboard' },
  { slug: 'sell-in', label: 'Sell In' },
  { slug: 'sell-out', label: 'Sell Out' },
  { slug: 'promo', label: 'Promo' },
  { slug: 'pnl', label: 'P&L' },
  { slug: 'comparison', label: 'Comparison' },
  { slug: 'sku-summary', label: 'SKU Summary' },
  { slug: 'company-summary', label: 'Company Summary' },
  { slug: 'company-sku-detail', label: 'Company SKU Detail' },
  { slug: 'settings', label: 'Settings' },
  { slug: 'imports', label: 'Imports' },
]

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { workspaceId: string }
}) {
  const { workspaceId } = params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .maybeSingle()

  if (!workspace) {
    redirect('/workspaces')
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-64 flex-col gap-6 border-r border-slate-800 bg-slate-950/80 px-6 py-8 md:flex">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Workspace
          </p>
          <h2 className="mt-2 text-lg font-semibold">{workspace.name}</h2>
          <Link
            href="/workspaces"
            className="mt-2 inline-flex text-xs text-slate-400 hover:text-slate-200"
          >
            Switch workspace
          </Link>
        </div>
        <nav className="flex flex-col gap-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.slug}
              href={`/workspace/${workspaceId}/${item.slug}`}
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
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Workspace
            </p>
            <h2 className="mt-1 text-sm font-semibold">{workspace.name}</h2>
          </div>
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
