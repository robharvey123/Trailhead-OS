import { NextResponse } from 'next/server'
import { screenDueContacts, type ScreenSummary } from '@/lib/ctps/screen'
import { DEFAULT_RESEND_FROM, resend } from '@/lib/email/resend'
import { supabaseService } from '@/lib/supabase/service'

export const maxDuration = 300

/**
 * 04:30 UTC daily: CTPS/TPS-screen every contact that was never screened or
 * was screened over 28 days ago (contacts_needing_ctps), up to 500 a night,
 * through Data Soap. Runs before the morning list build and call sheet so new
 * Monday prospects are callable the same day. If Data Soap stops the run
 * (credits exhausted, token rejected) Rob gets an email.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await screenDueContacts(supabaseService, { source: 'cron', limit: 500 })
    if (result.stoppedReason === 'insufficient_credit' || result.stoppedReason === 'provider_rejected') {
      await notifyStopped(result)
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'CTPS screen failed' }, { status: 500 })
  }
}

async function notifyStopped(summary: ScreenSummary) {
  const notificationEmail = process.env.NOTIFICATION_EMAIL
  if (!resend || !notificationEmail) return
  const subject =
    summary.stoppedReason === 'insufficient_credit'
      ? 'CTPS screening stopped: Data Soap credits exhausted'
      : 'CTPS screening stopped: Data Soap rejected the account'
  const lines = [
    `Attempted: ${summary.attempted}`,
    `Clear: ${summary.clear}`,
    `Registered (TPS/CTPS): ${summary.registered}`,
    `Failed: ${summary.failed}`,
    `Skipped / not reached: ${summary.skipped}`,
    `Credits used: ${summary.creditsUsed}`,
  ]
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_RESEND_FROM,
      to: [notificationEmail],
      subject,
      text: [
        'Tonight\'s CTPS/TPS screen stopped early. Unscreened numbers stay off the call queue until it runs again.',
        '',
        ...lines,
        '',
        summary.stoppedReason === 'insufficient_credit'
          ? 'Top up TPS credits in Data Soap; the next nightly run picks up where this one stopped.'
          : 'Check DATASOAP_API_TOKEN in Vercel and the Data Soap account status.',
      ].join('\n'),
    })
  } catch (error) {
    console.error('[ctps-screen] notification failed', error)
  }
}
