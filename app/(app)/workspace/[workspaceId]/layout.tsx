import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'
import WorkspaceSidebar from '@/components/nav/WorkspaceSidebar'

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
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <div className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950/60 pt-6 pl-6">
        <div className="mb-6 pr-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Workspace
          </p>
          <h2 className="mt-1 truncate text-sm font-semibold">{workspace.name}</h2>
          <Link
            href="/workspaces"
            className="mt-1 block text-[11px] text-slate-500 hover:text-slate-300"
          >
            Switch workspace
          </Link>
        </div>
        <WorkspaceSidebar workspaceId={workspaceId} />
      </div>
      <main className="flex-1 overflow-x-hidden px-8 py-8">
        {children}
      </main>
    </div>
  )
}
