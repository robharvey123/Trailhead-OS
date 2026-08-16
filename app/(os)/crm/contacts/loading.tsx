import { PanelTableSkeleton } from '@/components/os/skeletons'

/** Contacts: same chrome as accounts, one notch simpler — 7 columns, no bulk bar. */
export default function ContactsLoading() {
  return <PanelTableSkeleton statItems={4} filterbar columns={7} rows={10} actions={3} />
}
