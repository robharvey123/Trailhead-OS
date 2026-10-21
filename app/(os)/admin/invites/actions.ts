'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'
import { createInvite as createInviteRow, revokeInvite as revokeInviteRow } from '@/lib/db/invites'
import { createPerson } from '@/lib/db/people'
import { resend, DEFAULT_RESEND_FROM } from '@/lib/email/resend'
import { ASSIGNABLE_ROLES, type UserRole } from '@/lib/types'
import { inviteSalesUser } from '@/lib/auth/sales-invite'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(/\/$/, '')

function inviteEmailHtml(link: string) {
  return [
    `<p>Hi,</p>`,
    `<p>You've been invited to join <strong>Trailhead OS</strong>.</p>`,
    `<p><a href="${link}">Click here to set your password and claim your account</a>.</p>`,
    `<p>This link expires in 7 days.</p>`,
  ].join('\n')
}

export type CreateInviteResult =
  | { ok: true; link: string; emailed: boolean; kind: 'claim' | 'sales_link' }
  | { ok: false; error: string }

export async function createInvite(input: {
  email: string
  role: UserRole
  personId?: string
  newPerson?: { fullName: string; defaultRate?: number }
  displayName?: string
}): Promise<CreateInviteResult> {
  const supabase = await createClient()
  let admin
  try {
    admin = await requireAdmin(supabase)
  } catch {
    return { ok: false, error: 'Only an owner or admin can send invites.' }
  }

  // owner is DB-only; never invitable.
  if (!ASSIGNABLE_ROLES.includes(input.role)) return { ok: false, error: 'Invalid role for an invite.' }
  const email = input.email.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' }

  // Sales Lead: magic-link seat, no person link (see lib/auth/sales-invite.ts).
  if (input.role === 'sales') {
    const res = await inviteSalesUser({ email, displayName: input.displayName ?? null })
    if (!res.ok) return res
    try {
      await createInviteRow({ email, role: 'sales', person_id: null, invited_by: admin.id }, supabase)
    } catch {
      // The login and link already exist; the invites row is only the audit trail.
    }
    revalidatePath('/admin/invites')
    return { ok: true, link: res.link, emailed: res.emailed, kind: 'sales_link' }
  }

  let personId = input.personId || null
  let invite
  try {
    if (!personId && input.newPerson?.fullName?.trim()) {
      const person = await createPerson(
        { full_name: input.newPerson.fullName, email, default_hourly_rate_gbp: input.newPerson.defaultRate ?? null },
        supabase
      )
      personId = person.id
    }
    invite = await createInviteRow({ email, role: input.role, person_id: personId, invited_by: admin.id }, supabase)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create invite.' }
  }
  const link = `${APP_URL}/auth/claim/${invite.token}`

  let emailed = false
  if (resend) {
    try {
      await resend.emails.send({
        from: DEFAULT_RESEND_FROM,
        to: email,
        subject: "You've been invited to Trailhead OS",
        html: inviteEmailHtml(link),
      })
      emailed = true
    } catch {
      // Non-fatal — the admin still gets the copyable link.
    }
  }

  revalidatePath('/admin/invites')
  return { ok: true, link, emailed, kind: 'claim' }
}

export async function revokeInvite(id: string): Promise<void> {
  const supabase = await createClient()
  await requireAdmin(supabase)
  await revokeInviteRow(id, supabase)
  revalidatePath('/admin/invites')
}
