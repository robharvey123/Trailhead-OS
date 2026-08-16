import { CardTablePageSkeleton } from '@/components/os/skeletons'

/** Invoicing: header + outstanding pill → 6 status tabs → one card with a 9-column table. */
export default function InvoicingLoading() {
  return <CardTablePageSkeleton tabs={6} columns={9} rows={8} />
}
