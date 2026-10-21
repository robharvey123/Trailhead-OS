import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/roles'
import { screenContacts, screenDueContacts } from '@/lib/ctps/screen'
import { createClient } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const maxDuration = 300

const bodySchema = z.object({ contact_ids: z.array(z.string().uuid()).min(1).max(500).optional() })

/**
 * Admin-only "Screen now": CTPS/TPS-screen the given contacts, or everyone the
 * nightly cron would screen (contacts_needing_ctps, up to 500). Spends Data
 * Soap credits, so the sales seat can't reach it (middleware keeps it to
 * /sales and /api/sales, and requireAdmin refuses it here).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const raw: unknown = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(raw ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: 'contact_ids must be an array of up to 500 contact ids' }, { status: 400 })
  }

  try {
    const ids = parsed.data.contact_ids
    const summary = ids
      ? await screenContacts(supabaseService, ids, 'manual')
      : await screenDueContacts(supabaseService, { source: 'manual', limit: 500 })
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'CTPS screen failed' }, { status: 500 })
  }
}
