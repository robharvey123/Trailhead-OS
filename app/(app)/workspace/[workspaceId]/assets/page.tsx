import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'

export default async function AssetsPage({ params }: { params: Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const { data: assets } = await supabase.from('marketing_assets').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Marketing</p>
        <h1 className="mt-1 text-2xl font-semibold">Assets</h1>
        <p className="mt-1 text-sm text-slate-400">{(assets || []).length} asset{(assets || []).length !== 1 ? 's' : ''}</p>
      </div>

      {(!assets || assets.length === 0) ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center">
          <p className="text-sm text-slate-400">No assets uploaded yet.</p>
          <p className="mt-1 text-xs text-slate-500">Upload images, videos, and documents for your campaigns.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-slate-800/50 text-2xl text-slate-500">
                {a.file_type === 'image' ? '🖼️' : a.file_type === 'video' ? '🎬' : a.file_type === 'audio' ? '🎵' : '📄'}
              </div>
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="mt-1 text-xs text-slate-400">{a.file_type}{a.file_size_bytes ? ` · ${(a.file_size_bytes / 1024).toFixed(0)} KB` : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
