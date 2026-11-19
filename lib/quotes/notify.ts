import { COMPANY, EMAIL_FONT, BRAND } from '@/lib/brand'
import { DEFAULT_RESEND_FROM, resend } from '@/lib/email/resend'
import { escapeHtml } from '@/lib/escape-html'
import { pushToUser } from '@/lib/push/server'
import { appOrigin } from '@/lib/site'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Tell Rob about proposal activity (first open, question, acceptance, decline).
 *
 * Email is the primary channel: as of Phase 0 the owner profile had no push
 * subscriptions, so push alone would reach nobody. Push is sent as well, to
 * every owner/admin, so it starts working as soon as a browser subscribes.
 *
 * Best effort: failures are logged, never thrown, so a notification problem
 * can never break the client's action.
 */
export interface RobNotice {
  subject: string
  /** Plain sentences; each becomes a paragraph. Escaped here. */
  lines: string[]
  /** OS path, e.g. /quotes/<id>. Made absolute here. */
  osPath: string
  replyTo?: string
  pushTitle: string
  pushBody: string
  tag: string
}

export function osQuotePath(quoteId: string): string {
  return `/quotes/${quoteId}`
}

function noticeHtml(notice: RobNotice): string {
  const url = `${appOrigin()}${notice.osPath}`
  const paragraphs = notice.lines
    .map((line) => `<p style="margin:0 0 12px;color:${BRAND.body};white-space:pre-wrap">${escapeHtml(line)}</p>`)
    .join('')
  return `<div style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.5;max-width:560px">
${paragraphs}
<p style="margin:20px 0 0"><a href="${escapeHtml(url)}" style="color:${BRAND.blueInk}">Open in Trailhead OS</a></p>
</div>`
}

export async function notifyRob(notice: RobNotice): Promise<void> {
  const to = process.env.NOTIFICATION_EMAIL || COMPANY.email
  await Promise.allSettled([
    (async () => {
      if (!resend) {
        console.warn('[proposal] RESEND_API_KEY missing, notice not emailed:', notice.subject)
        return
      }
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_RESEND_FROM,
        to: [to],
        subject: notice.subject,
        html: noticeHtml(notice),
        text: [...notice.lines, '', `${appOrigin()}${notice.osPath}`].join('\n'),
        ...(notice.replyTo ? { replyTo: notice.replyTo } : {}),
      })
      if (error) console.error('[proposal] notice email failed', error)
    })(),
    (async () => {
      const { data } = await supabaseService.from('profiles').select('id').in('role', ['owner', 'admin'])
      await Promise.all(
        (data ?? []).map((p) =>
          pushToUser(p.id as string, {
            title: notice.pushTitle,
            body: notice.pushBody,
            url: notice.osPath,
            tag: notice.tag,
            category: 'push_quotes',
          })
        )
      )
    })(),
  ]).then((results) => {
    for (const r of results) if (r.status === 'rejected') console.error('[proposal] notice failed', r.reason)
  })
}
