import { CardTablePageSkeleton } from '@/components/os/skeletons'

/**
 * Expenses: header + total pills → 4 tabs → a filter row → one card with a
 * 9-column table. The filter row reads as a fifth "tab" here, which is close
 * enough at skeleton fidelity.
 */
export default function ExpensesLoading() {
  return <CardTablePageSkeleton tabs={4} columns={9} rows={8} />
}
