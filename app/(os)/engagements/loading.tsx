import { PanelTableSkeleton } from '@/components/os/skeletons'

/** Engagements: thmock panel → topbar → 4 stat items → 7-column table. */
export default function EngagementsLoading() {
  return <PanelTableSkeleton statItems={4} columns={7} rows={8} />
}
