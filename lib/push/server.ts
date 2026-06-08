import webpush from 'web-push'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Server-side Web Push dispatcher (brief 17). Reads subscriptions + settings
 * across users via the service role, sends via VAPID, and prunes dead endpoints.
 *
 * Call from server actions / API routes AFTER the triggering write — never from
 * RLS triggers (no secrets, no outbound HTTPS there). All entry points are
 * fire-and-forget: failures are swallowed so a push problem never breaks the
 * user action that triggered it.
 */

export type PushCategory = 'push_direct_message' | 'push_mention' | 'push_task_assigned' | 'push_new_email'
export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
  category: PushCategory
}

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  const subject = process.env.WEB_PUSH_SUBJECT
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE
  if (!subject || !publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

/** Send a push to every browser subscription of one auth user, gated by their settings. */
export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!userId || !ensureConfigured()) return

  const { data: profile } = await supabaseService
    .from('profiles')
    .select('notification_settings')
    .eq('id', userId)
    .maybeSingle()
  const settings = (profile?.notification_settings ?? {}) as Record<string, boolean>
  if (settings[payload.category] === false) return

  const { data: subs } = await supabaseService
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (!subs || subs.length === 0) return

  const body = JSON.stringify(payload)
  const liveIds: string[] = []

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
          body
        )
        liveIds.push(s.id as string)
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        // 404/410 → the browser dropped the subscription; delete it. Others: keep.
        if (code === 404 || code === 410) {
          await supabaseService.from('push_subscriptions').delete().eq('id', s.id)
        }
      }
    })
  )

  if (liveIds.length > 0) {
    await supabaseService
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .in('id', liveIds)
  }
}

/**
 * Resolve a person → their auth user (profiles.person_id) and push. Pass
 * excludeUserId to no-op when the resolved user is the actor (don't notify
 * yourself about your own mention/assignment).
 */
export async function pushToPerson(personId: string, payload: PushPayload, excludeUserId?: string): Promise<void> {
  if (!personId) return
  const { data } = await supabaseService.from('profiles').select('id').eq('person_id', personId).maybeSingle()
  const userId = data?.id as string | undefined
  if (userId && userId !== excludeUserId) await pushToUser(userId, payload)
}
