'use server'

import { redirect } from 'next/navigation'
import { supabaseService } from '@/lib/supabase/service'
import { applyUnsubscribe } from '@/lib/outreach/unsubscribe'

// Server actions are POST — a genuine user action, not a scanner GET.
export async function confirmUnsubscribe(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '')
  if (token) await applyUnsubscribe(supabaseService, token).catch(() => {})
  redirect('/unsubscribed')
}
