import { PanelTableSkeleton } from '@/components/os/skeletons'

/** Timesheet: topbar (+ timer widget) → 5 stat items → range/filter bar → 8-column table. */
export default function TimesheetLoading() {
  return <PanelTableSkeleton statItems={5} filterbar columns={8} rows={9} actions={3} />
}
