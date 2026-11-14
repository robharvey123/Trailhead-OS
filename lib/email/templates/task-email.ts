import { BRAND, EMAIL_FONT } from '@/lib/brand'

// Priority is a status colour: data, not brand. Amber and red match the OS tokens.
const STATUS = { red: '#DC2626', amber: '#D97706' } as const

interface TaskEmailTask {
  title: string
  description: string | null
  priority: string | null
  due_date: string | null
  owner: string | null
  status: string
  workstream_label: string | null
  project_name: string | null
  notes: string | null
}

interface TaskEmailData {
  tasks: TaskEmailTask[]
  recipientName?: string
  senderName?: string
  message?: string
  appUrl: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function safe(value: string | null | undefined): string {
  return value?.trim() ? escapeHtml(value.trim()) : '—'
}

function priorityColour(priority: string | null): string {
  switch (priority) {
    case 'critical':
    case 'urgent':
    case 'high':
      return STATUS.red
    case 'medium':
      return STATUS.amber
    default:
      return BRAND.slate
  }
}

function renderTaskCard(task: TaskEmailTask): string {
  const barColour = priorityColour(task.priority)

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border:1px solid ${BRAND.border};border-radius:8px;background-color:${BRAND.paper};">
      <tr><td style="height:3px;background-color:${barColour};border-radius:8px 8px 0 0;" colspan="2"></td></tr>
      <tr>
        <td style="padding:16px;" colspan="2">
          <p style="margin:0 0 12px 0;font-size:16px;font-weight:bold;color:${BRAND.navy};">${safe(task.title)}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
            <tr>
              <td style="width:25%;vertical-align:top;padding-right:8px;">
                <p style="margin:0;font-size:10px;font-weight:bold;text-transform:uppercase;color:${BRAND.slate};letter-spacing:1px;">Priority</p>
                <p style="margin:4px 0 0;font-size:12px;color:${BRAND.navy};">${safe(task.priority)}</p>
              </td>
              <td style="width:25%;vertical-align:top;padding-right:8px;">
                <p style="margin:0;font-size:10px;font-weight:bold;text-transform:uppercase;color:${BRAND.slate};letter-spacing:1px;">Due</p>
                <p style="margin:4px 0 0;font-size:12px;color:${BRAND.navy};">${safe(task.due_date)}</p>
              </td>
              <td style="width:25%;vertical-align:top;padding-right:8px;">
                <p style="margin:0;font-size:10px;font-weight:bold;text-transform:uppercase;color:${BRAND.slate};letter-spacing:1px;">Owner</p>
                <p style="margin:4px 0 0;font-size:12px;color:${BRAND.navy};">${safe(task.owner)}</p>
              </td>
              <td style="width:25%;vertical-align:top;">
                <p style="margin:0;font-size:10px;font-weight:bold;text-transform:uppercase;color:${BRAND.slate};letter-spacing:1px;">Workstream</p>
                <p style="margin:4px 0 0;font-size:12px;color:${BRAND.navy};">${safe(task.workstream_label)}</p>
              </td>
            </tr>
          </table>
          ${task.project_name ? `<p style="margin:0 0 4px;font-size:10px;font-weight:bold;text-transform:uppercase;color:${BRAND.slate};letter-spacing:1px;">Project</p><p style="margin:0 0 8px;font-size:12px;color:${BRAND.navy};">${safe(task.project_name)}</p>` : ''}
          ${task.description ? `<p style="margin:8px 0 0;font-size:12px;color:${BRAND.body};line-height:1.4;">${safe(task.description)}</p>` : ''}
          ${task.notes ? `<p style="margin:8px 0 0;font-size:12px;font-style:italic;color:${BRAND.slate};line-height:1.4;">${safe(task.notes)}</p>` : ''}
        </td>
      </tr>
    </table>`
}

export function buildTaskEmail(data: TaskEmailData): { subject: string; html: string } {
  const { tasks, message, appUrl } = data
  const count = tasks.length

  const subject =
    count === 1
      ? `Task: ${tasks[0].title} — ${tasks[0].priority ?? 'medium'} priority`
      : `${count} tasks from Trailhead OS`

  const summaryLine =
    count > 1
      ? `<p style="margin:0 0 16px;font-size:13px;color:${BRAND.slate};">${count} tasks assigned &middot; Sent from Trailhead OS</p>`
      : ''

  const messageBlock = message
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="border-left:3px solid ${BRAND.blue};padding:12px 16px;background-color:${BRAND.paper};border-radius:0 8px 8px 0;">
            <p style="margin:0;font-size:13px;color:${BRAND.body};line-height:1.5;">${escapeHtml(message)}</p>
          </td>
        </tr>
      </table>`
    : ''

  const taskCards = tasks.map(renderTaskCard).join('\n')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:${BRAND.coolLight};font-family:${EMAIL_FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.coolLight};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${BRAND.navy};border-bottom:3px solid ${BRAND.blue};padding:20px 24px;border-radius:8px 8px 0 0;">
              <p style="margin:0;font-size:14px;font-weight:bold;letter-spacing:3px;color:${BRAND.paper};">TRAILHEAD OS</p>
              <p style="margin:4px 0 0;font-size:11px;color:${BRAND.border};letter-spacing:1px;">Task Notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;">
              ${summaryLine}
              ${messageBlock}
              ${taskCards}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0;border-top:1px solid ${BRAND.border};">
              <p style="margin:0;font-size:11px;color:${BRAND.slate};">Sent from <a href="${escapeHtml(appUrl)}" style="color:${BRAND.blueInk};text-decoration:none;">Trailhead OS</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()

  return { subject, html }
}
