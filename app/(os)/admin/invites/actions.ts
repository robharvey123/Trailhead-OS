'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'
import { createInvite as createInviteRow, revokeInvite as revokeInviteRow } from '@/lib/db/invites'
import { createPerson } from '@/lib/db/people'
import { resend, DEFAULT_RESEND_FROM } from '@/lib/email/resend'
import { ASSIGNABLE_ROLES, type UserRole } from '@/lib/types'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(/\/$/, '')

function inviteEmailHtml(link: string) {
  return [
    `<p>Hi,</p>`,
    `<p>You've been invited to join <strong>Trailhead OS</strong>.</p>`,
    `<p><a href="${link}">Click here to set your password and claim your account</a>.</p>`,
    `<p>This link expires in 7 days.</p>`,
  ].join('\n')
}

export async function createInvite(input: {
  email: string
  role: UserRole
  personId?: string
  newPerson?: { fullName: string; defaultRate?: number }
}): Promise<{ token: string; link: string; emailed: boolean }> {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)

  // owner is DB-only; never invitable.
  if (!ASSIGNABLE_ROLES.includes(input.role)) throw new Error('Invalid role for an invite')
  const email = input.email.trim().toLowerCase()
  if (!email) throw new Error('Email is required')

  let personId = input.personId || null
  if (!personId && input.newPerson?.fullName?.trim()) {
    const person = await createPerson(
      { full_name: input.newPerson.fullName, email, default_hourly_rate_gbp: input.newPerson.defaultRate ?? null },
      supabase
    )
    personId = person.id
  }

  const invite = await createInviteRow({ email, role: input.role, person_id: personId, invited_by: admin.id }, supabase)
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
  return { token: invite.token, link, emailed }
}

export async function revokeInvite(id: string): Promise<void> {
  const supabase = await createClient()
  await requireAdmin(supabase)
  await revokeInviteRow(id, supabase)
  revalidatePath('/admin/invites')
}
