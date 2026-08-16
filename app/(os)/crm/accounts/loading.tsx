import { PanelTableSkeleton } from '@/components/os/skeletons'

/** Accounts: topbar → status-count bar → filter bar → 8-column table (col 1 = checkbox). */
export default function AccountsLoading() {
  return <PanelTableSkeleton statItems={5} filterbar columns={8} rows={10} />
}
