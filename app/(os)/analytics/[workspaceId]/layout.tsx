import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WorkspaceNav from '@/components/nav/WorkspaceNav'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

const navItems = [
  { slug: 'dashboard', label: 'Dashboard' },
  { slug: 'imports', label: 'Imports' },
  { slug: 'settings', label: 'Settings' },
]

export default async function AnalyticsWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<WorkspaceRouteParams>
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
    redirect('/analytics')
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Analytics
            </p>
            <h2 className="mt-1 text-lg font-semibold">{workspace.name}</h2>
          </div>
          <Link
            href="/analytics"
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Switch workspace
          </Link>
        </div>
        <div className="px-6 py-4">
          <WorkspaceNav
            items={navItems}
            workspaceId={workspaceId}
            basePath="/analytics"
          />
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}
