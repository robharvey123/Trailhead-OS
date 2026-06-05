import type { WeeklyUpdateData } from '@/lib/db/engagements'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Renders the Annex A clause 3.4 weekly client update as Markdown. */
export function renderWeeklyUpdate(d: WeeklyUpdateData): string {
  const e = d.engagement
  const lines: string[] = []

  lines.push(`# Weekly update — ${e.end_client?.name ?? e.name}`)
  lines.push(`**Week ending ${fmtDate(d.weekEnd)}**`)
  lines.push('')
  lines.push(`Engagement: ${e.name}${e.billed_via ? ` · Billed via ${e.billed_via.name}` : ''}`)
  lines.push('')

  lines.push('## 1. Hours & retainer')
  lines.push(`- This week: **${d.hoursWeek.toFixed(1)}h**`)
  lines.push(`- Month to date: **${d.hoursMonth.toFixed(1)}h${d.cap != null ? ` / ${d.cap}h cap (${d.pctOfCap}%)` : ''}**`)
  if (d.cap != null && d.pctOfCap > 100) lines.push(`- ⚠️ Over the monthly cap — overage to be discussed per the engagement terms.`)
  lines.push('')

  lines.push('## 2. Pipeline')
  if (d.pipeline.length === 0) lines.push('- No active deals on tracked accounts.')
  else for (const stage of d.pipeline) {
    lines.push(`**${stage.stage}**`)
    for (const deal of stage.deals) lines.push(`- ${deal.account} — ${deal.name}`)
  }
  lines.push('')

  lines.push('## 3. Tier-1 listing milestones')
  if (d.milestonesTouched.length === 0) lines.push('- No milestone changes this week.')
  else for (const m of d.milestonesTouched) lines.push(`- ${m.account}: ${m.condition} (${fmtDate(m.date)})`)
  lines.push('')

  lines.push('## 4. Next 7 days')
  if (d.tasks.length === 0) lines.push('- No scheduled actions.')
  else for (const t of d.tasks) lines.push(`- ${t.title}${t.due ? ` (due ${fmtDate(t.due)})` : ''}`)
  lines.push('')

  return lines.join('\n')
}

/** Minimal Markdown -> HTML for email send (headings, bold, lists). */
export function markdownToHtml(md: string): string {
  const html: string[] = []
  let inList = false
  for (const raw of md.split('\n')) {
    const line = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const bolded = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    if (/^### /.test(line)) { if (inList) { html.push('</ul>'); inList = false } html.push(`<h3>${bolded.slice(4)}</h3>`) }
    else if (/^## /.test(line)) { if (inList) { html.push('</ul>'); inList = false } html.push(`<h2>${bolded.slice(3)}</h2>`) }
    else if (/^# /.test(line)) { if (inList) { html.push('</ul>'); inList = false } html.push(`<h1>${bolded.slice(2)}</h1>`) }
    else if (/^- /.test(line)) { if (!inList) { html.push('<ul>'); inList = true } html.push(`<li>${bolded.slice(2)}</li>`) }
    else { if (inList) { html.push('</ul>'); inList = false } if (line.trim()) html.push(`<p>${bolded}</p>`) }
  }
  if (inList) html.push('</ul>')
  return html.join('\n')
}
