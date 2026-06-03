import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'
import { hasDocumentWrappers, stripDocumentWrappers } from '@/lib/email/strip-document'

/**
 * Admin-only: normalise os_company_settings.email_signature to inner HTML only
 * (strip any doctype/html/head/body). Idempotent — no-op if already clean.
 * Returns the previous value so the caller has an audit record + rollback path
 * (the key column is CHECK-constrained to 'default', so a backup row isn't an
 * option; the response is the rollback artifact).
 */
export async function POST() {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('os_company_settings')
    .select('email_signature')
    .eq('key', 'default')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const current = data?.email_signature ?? null
  if (!current || !hasDocumentWrappers(current)) {
    return NextResponse.json({ changed: false, status: 'clean' })
  }

  const cleaned = stripDocumentWrappers(current)
  const { error: upErr } = await supabase
    .from('os_company_settings')
    .update({ email_signature: cleaned, updated_at: new Date().toISOString() })
    .eq('key', 'default')
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({
    changed: true,
    previousLength: current.length,
    nextLength: cleaned.length,
    previous: current, // rollback artifact — re-save this to restore
  })
}
