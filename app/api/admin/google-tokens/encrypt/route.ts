import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/roles'
import { encryptToken, tokenEncryptionReady } from '@/lib/crypto/tokens'

/**
 * One-time (idempotent) backfill: encrypt any google_tokens rows still holding a
 * plaintext refresh_token, then null the plaintext. Admin-only. No-op once done.
 * Run after APP_ENCRYPTION_KEY is set in the environment.
 */
export async function POST() {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  if (!tokenEncryptionReady()) {
    return NextResponse.json({ error: 'APP_ENCRYPTION_KEY is not set — cannot encrypt.' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: rows, error } = await svc.from('google_tokens').select('id, refresh_token, refresh_token_encrypted')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let encrypted = 0
  for (const r of rows ?? []) {
    if (r.refresh_token && !r.refresh_token_encrypted) {
      const { error: upErr } = await svc
        .from('google_tokens')
        .update({ refresh_token_encrypted: encryptToken(r.refresh_token), refresh_token: null })
        .eq('id', r.id)
      if (upErr) return NextResponse.json({ error: upErr.message, encrypted }, { status: 500 })
      encrypted++
    }
  }
  return NextResponse.json({ ok: true, encrypted, total: rows?.length ?? 0 })
}
