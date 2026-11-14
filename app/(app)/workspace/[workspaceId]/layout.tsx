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
  { slug: 'insights', label: 'Insights' },
  { slug: 'sell-in', label: 'Sell In' },
  { slug: 'sell-out', label: 'Sell Out' },
  { slug: 'promo', label: 'Promo' },
  { slug: 'comparison', label: 'Compare' },
  { slug: 'pnl', label: 'P&L' },
  { slug: 'sku-summary', label: 'SKU Summary' },
  { slug: 'company-summary', label: 'Company Summary' },
  { slug: 'company-sku-detail', label: 'Company SKU' },
  { slug: 'tasks', label: 'Tasks' },
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
    // Navy island: token classes on the outer wrapper, layout utilities on the
    // inner one (see app/(app)/layout.tsx).
    <div className="thmock th-dark [color-scheme:dark]">
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <div className="border-b border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="os-label">Workspace</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
                  {workspace.name}
                </h2>
              </div>
              <Link
                href="/workspaces"
                className="text-xs font-semibold text-[var(--accent-strong)] hover:text-[var(--accent-hover)]"
              >
                Switch workspace
              </Link>
            </div>
            <WorkspaceNav items={navItems} workspaceId={workspaceId} />
          </div>
        </div>
        <main className="mx-auto w-full max-w-screen-2xl px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
