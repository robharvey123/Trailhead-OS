import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { buildTaskEmail } from '@/lib/email/templates/task-email'
import { resend, DEFAULT_RESEND_FROM } from '@/lib/email/resend'

const TASK_EMAIL_SELECT = `
  id,
  title,
  description,
  priority,
  due_date,
  owner,
  status,
  completed_at,
  workstreams:workstream_id(label),
  projects:project_id(name)
`

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))

  const taskIds: unknown = body.taskIds
  const recipients: unknown = body.recipients
  const message: string | undefined = typeof body.message === 'string' ? body.message.trim() || undefined : undefined
  const senderName: string | undefined = typeof body.senderName === 'string' ? body.senderName.trim() || undefined : undefined

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: 'taskIds must be a non-empty array' }, { status: 400 })
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'recipients must be a non-empty array' }, { status: 400 })
  }

  const validRecipients = recipients.filter(
    (r): r is string => typeof r === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r)
  )

  if (validRecipients.length === 0) {
    return NextResponse.json({ error: 'No valid email addresses provided' }, { status: 400 })
  }

  if (!resend) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  try {
    const { data: tasks, error: taskError } = await auth.supabase
      .from('tasks')
      .select(TASK_EMAIL_SELECT)
      .in('id', taskIds.map(String))

    if (taskError) throw taskError
    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ error: 'No tasks found' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''

    const emailData = {
      tasks: tasks.map((t) => {
        const ws = firstRelation(t.workstreams as { label: string } | { label: string }[] | null)
        const proj = firstRelation(t.projects as { name: string } | { name: string }[] | null)

        return {
          title: t.title as string,
          description: t.description as string | null,
          priority: t.priority as string | null,
          due_date: t.due_date as string | null,
          owner: t.owner as string | null,
          status: t.completed_at ? 'done' : (t.status as string),
          workstream_label: ws?.label ?? null,
          project_name: proj?.name ?? null,
          notes: null,
        }
      }),
      message,
      senderName,
      appUrl,
    }

    const { subject, html } = buildTaskEmail(emailData)

    const { error: sendError } = await resend.emails.send({
      from: DEFAULT_RESEND_FROM,
      to: validRecipients,
      subject,
      html,
    })

    if (sendError) throw sendError

    return NextResponse.json({ success: true, sent: validRecipients.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send task email' },
      { status: 500 }
    )
  }
}
