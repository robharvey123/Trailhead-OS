import { redirect } from 'next/navigation'

// The per-workstream kanban is retired (brief 19). Old bookmarks land on the
// flat projects list. Kept as a route (not a next.config redirect) so the static
// /projects/records and /projects/new siblings keep precedence.
export default async function WorkstreamBoardPage() {
  redirect('/projects')
}
