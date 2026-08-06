import { redirect } from 'next/navigation'

// Retired: the old markdown weekly-update surface predated the Stage A–C
// client-safety work (spine, client_visible filter, C3 gate, branding) and could
// leak internal kanban tasks. One client-facing weekly surface now — the Reports
// tab. Route kept so bookmarks land somewhere sensible.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/engagements/${id}/reports`)
}
