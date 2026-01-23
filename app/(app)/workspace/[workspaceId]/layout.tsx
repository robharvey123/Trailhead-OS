import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'
import WorkspaceNav from '@/components/nav/WorkspaceNav'

const navItems = [
  { slug: 'dashboard', label: 'Dashboard' },
  { slug: 'sell-in', label: 'Sell In' },
  { slug: 'sell-out', label: 'Sell Out' },
  { slug: 'promo', label: 'Promo' },
  { slug: 'comparison', label: 'Compare' },
  { slug: 'pnl', label: 'P&L' },
  { slug: 'sku-summary', label: 'SKU Summary' },
  { slug: 'company-summary', label: 'Company Summary' },
  { slug: 'company-sku-detail', label: 'Company SKU' },
  { slug: 'settings', label: 'Settings' },
  { slug: 'imports', label: 'Imports' },
]

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const resolvedParams = await resolveWorkspaceParams(params)
  const { workspaceId } = resolvedParams
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Workspace
              </p>
              <h2 className="mt-1 text-lg font-semibold">{workspace.name}</h2>
            </div>
            <Link
              href="/workspaces"
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Switch workspace
            </Link>
          </div>
          <WorkspaceNav items={navItems} workspaceId={workspaceId} />
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
