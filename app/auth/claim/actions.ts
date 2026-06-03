'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Same message for invalid / expired / claimed, to avoid leaking which emails
// have pending invites (email enumeration).
const GENERIC_TOKEN_ERROR = 'This invite link is invalid or has expired.'

interface ClaimableInvite {
  id: string
  email: string
  role: 'owner' | 'admin' | 'employee' | 'contractor'
  person_id: string | null
}

/** Server-side token lookup via service role (public page; invitee is not yet authed). */
export async function lookupClaimableInvite(token: string): Promise<{ email: string } | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('invites').select('email, expires_at, claimed_at').eq('token', token).maybeSingle()
  if (!data || data.claimed_at || new Date(data.expires_at) < new Date()) return null
  return { email: data.email as string }
}

export async function claimInvite(token: string, password: string): Promise<{ error: string } | void> {
  if (!password || password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('invites')
    .select('id, email, role, person_id, expires_at, claimed_at')
    .eq('token', token)
    .maybeSingle()
  if (!invite || invite.claimed_at || new Date(invite.expires_at) < new Date()) {
    return { error: GENERIC_TOKEN_ERROR }
  }
  const inv = invite as unknown as ClaimableInvite & { expires_at: string; claimed_at: string | null }

  // 1. Create the auth user (service role). Trigger auto-creates the profile.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: inv.email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    return { error: 'Could not create your account. It may already exist — try signing in.' }
  }
  const userId = created.user.id

  // 2. Apply the invited role + person link; 3. mark the invite claimed.
  await admin.from('profiles').update({ role: inv.role, person_id: inv.person_id }).eq('id', userId)
  if (inv.person_id) await admin.from('people').update({ auth_user_id: userId }).eq('id', inv.person_id)
  await admin.from('invites').update({ claimed_at: new Date().toISOString(), claimed_by: userId }).eq('id', inv.id)

  // 4. Sign in (sets the session cookies through the SSR client).
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: inv.email, password })
  if (signInErr) return { error: 'Account created — please sign in.' }

  redirect('/settings')
}
