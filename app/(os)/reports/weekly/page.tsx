import { getInternalWeeklyReport } from '@/lib/reports/data'
import InternalWeeklyClient from './InternalWeeklyClient'

export const dynamic = 'force-dynamic'

const MAX_BACK = 4 // current week + 4 weeks back

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string }>
}) {
  const sp = searchParams ? await searchParams : undefined
  let offset = Number(sp?.week ?? 0)
  if (!Number.isInteger(offset) || offset > 0) offset = 0
  if (offset < -MAX_BACK) offset = -MAX_BACK

  const data = await getInternalWeeklyReport(offset)
  return <InternalWeeklyClient data={data} maxBack={MAX_BACK} />
}
