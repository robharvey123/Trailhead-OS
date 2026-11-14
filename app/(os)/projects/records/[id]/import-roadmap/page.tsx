import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import { RoadmapExtractionSchema, type RoadmapExtraction } from '@/lib/roadmap/schema'
import { mockupFontVars } from '@/lib/fonts'
import PageHeader from '@/components/ui/PageHeader'
import RoadmapUploadClient from './RoadmapUploadClient'
import RoadmapReviewClient from './RoadmapReviewClient'

export const dynamic = 'force-dynamic'

export default async function ImportRoadmapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ import_id?: string }>
}) {
  const { id } = await params
  const { import_id: importId } = await searchParams
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) redirect('/login')
  if (!roleIsAdmin(profile.role)) redirect(`/projects/records/${id}`)

  if (importId) {
    const { data: imp } = await supabase.from('roadmap_imports').select('*').eq('id', importId).maybeSingle()
    if (!imp) notFound()
    const parsed = RoadmapExtractionSchema.safeParse(imp.committed_json ?? imp.extracted_json)
    const extraction: RoadmapExtraction = parsed.success ? parsed.data : { milestones: [] }
    return (
      <div className={`thmock ${mockupFontVars}`}>
        <div className="os-narrow">
          <RoadmapReviewClient
            projectId={id}
            importId={importId}
            initial={extraction}
            committed={imp.status === 'committed'}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="os-narrow">
        <PageHeader title="Import roadmap" back={{ href: `/projects/records/${id}`, label: 'Project' }} />
        <div className="panel overflow-hidden">
          <div style={{ padding: 24 }}>
            <RoadmapUploadClient projectId={id} />
          </div>
        </div>
      </div>
    </div>
  )
}
