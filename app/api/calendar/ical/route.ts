import { NextRequest } from 'next/server'
import ical from 'ical-generator'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token || token !== process.env.ICAL_SECRET) {
    return new Response('Unauthorised', { status: 401 })
  }

  const workstream = searchParams.get('workstream')

  let workstreamId: string | null = null
  if (workstream) {
    const { data: ws } = await supabaseService
      .from('workstreams')
      .select('id')
      .eq('slug', workstream)
      .maybeSingle()

    workstreamId = ws?.id ?? null
  }

  let eventsQuery = supabaseService
    .from('calendar_events')
    .select(`
      *,
      workstreams(label, slug)
    `)
    .order('start_at', { ascending: true })

  if (workstreamId) {
    eventsQuery = eventsQuery.eq('workstream_id', workstreamId)
  }

  const { data: events } = await eventsQuery

  let tasksQuery = supabaseService
    .from('tasks')
    .select(`
      *,
      workstreams(label, slug)
    `)
    .not('due_date', 'is', null)
    .is('completed_at', null)
    .order('due_date', { ascending: true })

  if (workstreamId) {
    tasksQuery = tasksQuery.eq('workstream_id', workstreamId)
  }

  const { data: tasks } = await tasksQuery

  let milestonesQuery = supabaseService
    .from('project_milestones')
    .select(`
      *,
      projects(name, workstream_id,
        workstreams(label, slug))
    `)
    .eq('completed', false)
    .order('date', { ascending: true })

  if (workstreamId) {
    milestonesQuery = milestonesQuery.eq('projects.workstream_id', workstreamId)
  }

  const { data: milestones } = await milestonesQuery

  const cal = ical({
    name: 'Trailhead OS',
    description: 'Calendar, tasks and milestones from Trailhead OS',
    timezone: 'Europe/London',
    url: `${process.env.NEXT_PUBLIC_APP_URL}`,
  })

  for (const event of events || []) {
    const workstreamLabel = Array.isArray((event as { workstreams?: { label: string }[] }).workstreams)
      ? (event as { workstreams?: { label: string }[] }).workstreams?.[0]?.label
      : (event as { workstreams?: { label: string } }).workstreams?.label

    cal.createEvent({
      id: `event-${event.id}`,
      start: new Date(event.start_at),
      end: new Date(event.end_at),
      allDay: event.all_day,
      summary: event.title,
      description: [event.description, workstreamLabel ? `Workstream: ${workstreamLabel}` : null, event.location ? `Location: ${event.location}` : null]
        .filter(Boolean)
        .join('\n'),
      location: event.location || undefined,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/calendar`,
    })
  }

  for (const task of tasks || []) {
    const workstreamLabel = Array.isArray((task as { workstreams?: { label: string }[] }).workstreams)
      ? (task as { workstreams?: { label: string }[] }).workstreams?.[0]?.label
      : (task as { workstreams?: { label: string } }).workstreams?.label
    const priorityEmoji = {
      urgent: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    }[(task.priority as string) ?? 'medium'] ?? '⚪'

    cal.createEvent({
      id: `task-${task.id}`,
      start: new Date(`${task.due_date}T00:00:00`),
      end: new Date(`${task.due_date}T23:59:59`),
      allDay: true,
      summary: `${priorityEmoji} ${task.title}`,
      description: [task.description, workstreamLabel ? `Workstream: ${workstreamLabel}` : null, `Priority: ${task.priority}`]
        .filter(Boolean)
        .join('\n'),
      url: `${process.env.NEXT_PUBLIC_APP_URL}/tasks`,
    })
  }

  for (const milestone of milestones || []) {
    const projects = Array.isArray((milestone as { projects?: { name: string }[] }).projects)
      ? (milestone as { projects?: { name: string }[] }).projects?.[0]
      : (milestone as { projects?: { name: string } }).projects
    const projectName = projects?.name

    cal.createEvent({
      id: `milestone-${milestone.id}`,
      start: new Date(`${milestone.date}T00:00:00`),
      end: new Date(`${milestone.date}T23:59:59`),
      allDay: true,
      summary: `⬟ ${milestone.name}`,
      description: [milestone.description, projectName ? `Project: ${projectName}` : null]
        .filter(Boolean)
        .join('\n'),
      url: `${process.env.NEXT_PUBLIC_APP_URL}/calendar`,
    })
  }

  return new Response(cal.toString(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="trailhead.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
