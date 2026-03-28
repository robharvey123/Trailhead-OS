import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import ScheduleClient from './ScheduleClient'

export default async function SchedulePage({ params }: { params: Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const [schedulesRes, staffRes] = await Promise.all([
    supabase.from('staff_schedules').select('*, staff_profiles(display_name)').eq('workspace_id', workspaceId).gte('date', weekStart.toISOString().slice(0, 10)).lte('date', weekEnd.toISOString().slice(0, 10)).order('date').order('start_time'),
    supabase.from('staff_profiles').select('id, display_name').eq('workspace_id', workspaceId).order('display_name'),
  ])

  const schedules = (schedulesRes.data || []).map((d: Record<string, unknown>) => ({ ...d, staff_name: (d.staff_profiles as { display_name: string } | null)?.display_name || null })) as unknown as import('@/lib/staffing/types').StaffSchedule[]

  return <ScheduleClient workspaceId={workspaceId} initialSchedules={schedules} staffList={staffRes.data || []} weekStart={weekStart.toISOString().slice(0, 10)} />
}
