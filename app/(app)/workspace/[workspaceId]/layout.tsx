import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'
import WorkspaceSidebar, {
  BRAND_NAV_SECTIONS,
  HOLDING_NAV_SECTIONS,
} from '@/components/nav/WorkspaceSidebar'

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
    .select('id, name, type')
    .eq('id', workspaceId)
    .maybeSingle()

  if (!workspace) {
    redirect('/workspaces')
  }

  const sections =
    workspace.type === 'holding' ? HOLDING_NAV_SECTIONS : BRAND_NAV_SECTIONS

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <div className="flex flex-col border-r border-slate-800">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Workspace
            </p>
            <h2 className="truncate text-sm font-semibold">
              {workspace.name}
            </h2>
          </div>
          <Link
            href="/workspaces"
            className="shrink-0 text-[10px] text-slate-500 hover:text-slate-300"
          >
            Switch
          </Link>
        </div>
        <WorkspaceSidebar workspaceId={workspaceId} sections={sections} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
      </main>
    </div>
  )
}
