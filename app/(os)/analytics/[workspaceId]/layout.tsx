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
      <div className="os-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
          <div>
            <p className="os-label">Analytics</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
              {workspace.name}
            </h2>
          </div>
          <Link
            href="/analytics"
            className="text-xs font-semibold text-[var(--accent-strong)] hover:text-[var(--accent-hover)]"
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
