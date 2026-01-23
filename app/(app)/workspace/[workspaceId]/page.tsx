import { createClient } from '@/lib/supabase/server'

export default async function WorkspacePage({
  params,
}: {
  params: { workspaceId: string }
}) {
  const { workspaceId } = params
  const supabase = createClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .maybeSingle()

  if (!workspace) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
        Workspace not found or you do not have access.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{workspace.name}</h1>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
        Workspace context will power analytics pages. Next steps: imports, filters,
        and data views.
      </div>
    </div>
  )
}
