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
      return '#FF6B35'
    case 'medium':
      return '#FBBF24'
    default:
      return '#9CA3AF'
  }
}

function renderTaskCard(task: TaskEmailTask): string {
  const barColour = priorityColour(task.priority)

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border:1px solid #2A2A3A;border-radius:4px;background-color:#1A1A28;">
      <tr><td style="height:3px;background-color:${barColour};border-radius:4px 4px 0 0;" colspan="2"></td></tr>
      <tr>
        <td style="padding:16px;" colspan="2">
          <p style="margin:0 0 12px 0;font-size:16px;font-weight:bold;color:#ffffff;">${safe(task.title)}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
            <tr>
              <td style="width:25%;vertical-align:top;padding-right:8px;">
                <p style="margin:0;font-size:10px;font-weight:bold;text-transform:uppercase;color:#9CA3AF;letter-spacing:1px;">Priority</p>
                <p style="margin:4px 0 0;font-size:12px;color:#ffffff;">${safe(task.priority)}</p>
              </td>
              <td style="width:25%;vertical-align:top;padding-right:8px;">
                <p style="margin:0;font-size:10px;font-weight:bold;text-transform:uppercase;color:#9CA3AF;letter-spacing:1px;">Due</p>
                <p style="margin:4px 0 0;font-size:12px;color:#ffffff;">${safe(task.due_date)}</p>
              </td>
              <td style="width:25%;vertical-align:top;padding-right:8px;">
                <p style="margin:0;font-size:10px;font-weight:bold;text-transform:uppercase;color:#9CA3AF;letter-spacing:1px;">Owner</p>
                <p style="margin:4px 0 0;font-size:12px;color:#ffffff;">${safe(task.owner)}</p>
              </td>
              <td style="width:25%;vertical-align:top;">
                <p style="margin:0;font-size:10px;font-weight:bold;text-transform:uppercase;color:#9CA3AF;letter-spacing:1px;">Workstream</p>
                <p style="margin:4px 0 0;font-size:12px;color:#ffffff;">${safe(task.workstream_label)}</p>
              </td>
            </tr>
          </table>
          ${task.project_name ? `<p style="margin:0 0 4px;font-size:10px;font-weight:bold;text-transform:uppercase;color:#9CA3AF;letter-spacing:1px;">Project</p><p style="margin:0 0 8px;font-size:12px;color:#ffffff;">${safe(task.project_name)}</p>` : ''}
          ${task.description ? `<p style="margin:8px 0 0;font-size:12px;color:#9CA3AF;line-height:1.4;">${safe(task.description)}</p>` : ''}
          ${task.notes ? `<p style="margin:8px 0 0;font-size:12px;font-style:italic;color:#9CA3AF;line-height:1.4;">${safe(task.notes)}</p>` : ''}
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
      ? `<p style="margin:0 0 16px;font-size:13px;color:#9CA3AF;">${count} tasks assigned &middot; Sent from Trailhead OS</p>`
      : ''

  const messageBlock = message
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="border-left:3px solid #B8FF00;padding:12px 16px;background-color:#13131E;border-radius:0 4px 4px 0;">
            <p style="margin:0;font-size:13px;color:#ffffff;line-height:1.5;">${escapeHtml(message)}</p>
          </td>
        </tr>
      </table>`
    : ''

  const taskCards = tasks.map(renderTaskCard).join('\n')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#0C0C14;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0C0C14;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:#1A1A28;border-bottom:3px solid #B8FF00;padding:20px 24px;">
              <p style="margin:0;font-size:14px;font-weight:bold;letter-spacing:3px;color:#B8FF00;">TRAILHEAD OS</p>
              <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF;letter-spacing:1px;">Task Notification</p>
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
            <td style="padding:16px 0;border-top:1px solid #2A2A3A;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;">Sent from <a href="${escapeHtml(appUrl)}" style="color:#B8FF00;text-decoration:none;">Trailhead OS</a></p>
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
