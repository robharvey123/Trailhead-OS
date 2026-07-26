import { supabaseService } from '@/lib/supabase/service'
import { sendCampaignEmail } from './send'
import type { OutreachCampaign, OutreachCampaignStep, OutreachStoppedReason } from '@/lib/types'

const DAY_MS = 86_400_000
const THROTTLE_MS = 500 // ≤ 2 sends/sec (Resend default is 5 rps, shared with the app)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// --- Timezone helpers: all window/day arithmetic is done in the campaign's tz,
// never with naive UTC Date math (offset flips at the Oct clock change). --------

const WEEKDAY_ISO: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

function zonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') map[p.type] = p.value
  return {
    year: +map.year, month: +map.month, day: +map.day,
    hour: +map.hour, minute: +map.minute, second: +map.second,
    isoWeekday: WEEKDAY_ISO[map.weekday] ?? 0,
    minutesOfDay: (+map.hour) * 60 + (+map.minute),
  }
}

/** UTC instant for the start of `date`'s calendar day in the given tz. */
function startOfZonedDayUtc(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone)
  const guess = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0)
  // Offset of the tz at (roughly) that midnight, so we land on the true instant.
  const gp = zonedParts(new Date(guess), timeZone)
  const asUtc = Date.UTC(gp.year, gp.month - 1, gp.day, gp.hour, gp.minute, gp.second)
  const offset = asUtc - guess
  return new Date(guess - offset)
}

/** 'HH:MM[:SS]' → minutes since midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':')
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}

export interface OutreachTickResult {
  campaigns: number
  sent: number
  stopped: number
  skipped: number
}

/**
 * One scheduler pass: for each running campaign, if we're inside its send window
 * and day, work through the due recipients up to the remaining daily budget —
 * running stop checks, claiming optimistically, sending, then advancing.
 */
export async function runOutreachTick(): Promise<OutreachTickResult> {
  const db = supabaseService
  const now = new Date()
  const result: OutreachTickResult = { campaigns: 0, sent: 0, stopped: 0, skipped: 0 }

  const { data: campaigns } = await db.from('outreach_campaigns').select('*').eq('status', 'running')
  for (const campaign of (campaigns ?? []) as OutreachCampaign[]) {
    const tz = campaign.timezone || 'Europe/London'
    const nowParts = zonedParts(now, tz)

    // Day-of-week + send window (in the campaign tz).
    if (!campaign.send_days?.includes(nowParts.isoWeekday)) continue
    if (nowParts.minutesOfDay < timeToMinutes(campaign.send_window_start)) continue
    if (nowParts.minutesOfDay >= timeToMinutes(campaign.send_window_end)) continue

    // Remaining daily budget: cap minus sends already made today (campaign tz).
    const startOfToday = startOfZonedDayUtc(now, tz).toISOString()
    const { count: sentToday } = await db
      .from('outreach_sends')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .gte('sent_at', startOfToday)
    const budget = (campaign.daily_send_cap ?? 0) - (sentToday ?? 0)
    if (budget <= 0) continue

    result.campaigns++

    // Steps (ordered) so we can look up delays / detect the last step.
    const { data: stepRows } = await db.from('outreach_campaign_steps').select('*').eq('campaign_id', campaign.id).order('step_number', { ascending: true })
    const steps = (stepRows ?? []) as OutreachCampaignStep[]

    // Due recipients, capped to the remaining budget.
    const { data: recipients } = await db
      .from('outreach_recipients')
      .select('id, contact_id, status, current_step, created_at, contact:contacts(email, do_not_email)')
      .eq('campaign_id', campaign.id)
      .in('status', ['pending', 'active'])
      .lte('next_send_at', now.toISOString())
      .limit(budget)

    for (const r of (recipients ?? []) as unknown as Array<{
      id: string; contact_id: string; status: string; current_step: number; created_at: string
      contact: { email: string | null; do_not_email: boolean | null } | null
    }>) {
      const email = r.contact?.email?.trim() ?? ''

      // Stop checks, in order. Any hit stops the recipient and skips the send.
      let stop: OutreachStoppedReason | null = null
      if (email) {
        const { data: sup } = await db.from('email_suppressions').select('id').ilike('email', email).maybeSingle()
        if (sup) stop = 'unsubscribed'
      }
      if (!stop && r.contact?.do_not_email) stop = 'unsubscribed'
      if (!stop) {
        const { data: reply } = await db
          .from('email_logs')
          .select('id')
          .eq('direction', 'inbound')
          .eq('contact_id', r.contact_id)
          .gte('received_at', r.created_at)
          .limit(1)
          .maybeSingle()
        if (reply) stop = 'replied'
      }
      if (stop) {
        await db.from('outreach_recipients').update({ status: 'stopped', stopped_reason: stop, stopped_at: new Date().toISOString() }).eq('id', r.id)
        result.stopped++
        continue
      }

      // Optimistic claim — only proceed if we win the status transition.
      const { data: claimed } = await db
        .from('outreach_recipients')
        .update({ status: 'active', next_send_at: null })
        .eq('id', r.id)
        .eq('status', r.status)
        .select('id')
      if (!claimed || claimed.length === 0) continue

      const send = await sendCampaignEmail({ recipientId: r.id })

      if (!send.ok) {
        if ('skipped' in send) {
          await db.from('outreach_recipients').update({ status: 'stopped', stopped_reason: 'unsubscribed', stopped_at: new Date().toISOString() }).eq('id', r.id)
          result.stopped++
        } else {
          // Transient failure — retry on a later tick rather than getting stuck.
          await db.from('outreach_recipients').update({ next_send_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }).eq('id', r.id)
          result.skipped++
        }
        await sleep(THROTTLE_MS)
        continue
      }

      // Advance: next step (delay from that step) or complete.
      const nextIndex = r.current_step + 1
      const nextStep = steps[nextIndex]
      if (nextStep) {
        await db.from('outreach_recipients').update({
          current_step: nextIndex,
          next_send_at: new Date(Date.now() + (nextStep.delay_days ?? 0) * DAY_MS).toISOString(),
          status: 'active',
        }).eq('id', r.id)
      } else {
        await db.from('outreach_recipients').update({ current_step: nextIndex, status: 'completed', next_send_at: null }).eq('id', r.id)
      }
      result.sent++
      await sleep(THROTTLE_MS)
    }
  }

  return result
}
