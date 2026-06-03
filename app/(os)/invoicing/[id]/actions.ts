'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'
import { softDeleteInvoice } from '@/lib/db/invoices'

/**
 * Soft-delete an invoice (admin only). Enforcement is the requireAdmin guard
 * here (+ the UI hides the button for non-admins); invoices RLS stays
 * is_employee, so this is the authorisation boundary for delete.
 */
export async function deleteInvoice(id: string): Promise<{ error: string } | void> {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return { error: 'Not authorised' }
  }
  await softDeleteInvoice(id, supabase)
  revalidatePath('/invoicing')
  redirect('/invoicing')
}
