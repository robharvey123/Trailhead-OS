import { createAdminClient } from '@/lib/supabase/admin'
import { resend, DEFAULT_RESEND_FROM } from '@/lib/email/resend'

// On a Vercel preview, links must open that preview (its branch alias), not
// production, or a seat invited from a preview lands on code that isn't live.
const APP_URL = (
  process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_BRANCH_URL
    ? `https://${process.env.VERCEL_BRANCH_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk'
).replace(/\/$/, '')
export const SALES_WELCOME_PATH = '/sales/welcome'

/** Roles a sales invite may (re)assign. Anything else is an existing staff login and is left alone. */
const REPLACEABLE_ROLES = new Set(['sales', 'contractor'])

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

function salesInviteEmailHtml(link: string, displayName: string | null, isNew: boolean) {
  const hello = displayName ? `Hi ${escapeHtml(displayName.split(' ')[0])},` : 'Hi,'
  return [
    `<p>${hello}</p>`,
    isNew
      ? `<p>You've been set up as Sales Lead on <strong>Trailhead OS</strong>. Your call queue, pipeline and dashboard are ready.</p>`
      : `<p>Here's a fresh sign-in link for <strong>Trailhead OS</strong>.</p>`,
    `<p><a href="${link}">Open Trailhead OS and sign in</a></p>`,
    `<p>The first time, you'll choose a password so you can sign in normally after that.</p>`,
    `<p>The link works once and expires soon, so use it today. If it has expired, ask Rob for a new one.</p>`,
  ].join('\n')
}

export type SalesInviteResult =
  | { ok: true; userId: string; link: string; emailed: boolean; isNewUser: boolean }
  | { ok: false; error: string }

/**
 * Create (or refresh) the Sales Lead login and email a scanner-safe sign-in
 * link: /auth/confirm?token_hash=… → /auth/accept (button) → POST verifies.
 *
 * The auth user is created up front by the Admin API, so this works with
 * public sign-ups disabled. The profile gets role 'sales' immediately and no
 * person link, so the seat never inherits engagement, task or time access.
 * An existing owner/admin/employee login is never changed.
 */
export async function inviteSalesUser(input: { email: string; displayName: string | null }): Promise<SalesInviteResult> {
  const email = input.email.trim().toLowerCase()
  const displayName = input.displayName?.trim() || null
  const admin = createAdminClient()

  // New user: an 'invite' link (creates the auth user). Existing user: 'magiclink'.
  let type: 'invite' | 'magiclink' = 'invite'
  let gen = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: displayName ? { data: { full_name: displayName } } : undefined,
  })
  if (gen.error && /already|registered|exists/i.test(gen.error.message)) {
    type = 'magiclink'
    gen = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  }
  if (gen.error || !gen.data?.user || !gen.data.properties?.hashed_token) {
    return { ok: false, error: gen.error?.message ?? 'Could not create a sign-in link.' }
  }
  const userId = gen.data.user.id

  const { data: profile } = await admin.from('profiles').select('role, person_id').eq('id', userId).maybeSingle()
  if (profile && !REPLACEABLE_ROLES.has(String(profile.role))) {
    return { ok: false, error: `${email} already has a ${profile.role} login, so it can't be made a Sales Lead seat.` }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert(
      { id: userId, role: 'sales', person_id: null, ...(displayName ? { display_name: displayName } : {}) },
      { onConflict: 'id' }
    )
  if (profileError) return { ok: false, error: `Could not set the Sales Lead role: ${profileError.message}` }

  const params = new URLSearchParams({ token_hash: gen.data.properties.hashed_token, type, next: SALES_WELCOME_PATH })
  const link = `${APP_URL}/auth/confirm?${params.toString()}`

  let emailed = false
  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: DEFAULT_RESEND_FROM,
        to: email,
        subject: type === 'invite' ? "You're set up on Trailhead OS" : 'Your Trailhead OS sign-in link',
        html: salesInviteEmailHtml(link, displayName, type === 'invite'),
      })
      emailed = !error
    } catch {
      emailed = false
    }
  }

  return { ok: true, userId, link, emailed, isNewUser: type === 'invite' }
}
