import { getWeeklyReportData } from '@/lib/db/weekly-report'
import WeeklyReportClient from './WeeklyReportClient'

export const dynamic = 'force-dynamic'

export default async function WeeklyReportPage() {
  const data = await getWeeklyReportData()

  return <WeeklyReportClient initialData={data} />
}
