import { CardTablePageSkeleton } from '@/components/os/skeletons'

/** Quotes: header → 2 stat cards → 6 status tabs → one card with an 8-column table. */
export default function QuotesLoading() {
  return <CardTablePageSkeleton statCards={2} tabs={6} columns={8} rows={8} />
}
