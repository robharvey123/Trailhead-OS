import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { NextRequest, NextResponse } from 'next/server'

interface RecipientInput {
  email: string
  name?: string
  account_id?: string | null
  new_account_name?: string | null
}

// POST { recipients: RecipientInput[] }
// Creates accounts (from new_account_name, deduped) and contacts (idempotent on
// lower(email)), setting account_id so future emails auto-link. Returns created contacts.
export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const body = await request.json()
    const recipients: RecipientInput[] = Array.isArray(body.recipients) ? body.recipients : []
    if (recipients.length === 0) return NextResponse.json({ contacts: [] })

    // Resolve / create accounts by new_account_name (deduped, case-insensitive).
    const accountByName = new Map<string, string>()
    for (const r of recipients) {
      const an = r.new_account_name?.trim()
      if (!an || accountByName.has(an.toLowerCase())) continue
      const { data: existing } = await supabase.from('accounts').select('id').eq('record_type', 'sales').ilike('name', an).limit(1).maybeSingle()
      if (existing) { accountByName.set(an.toLowerCase(), existing.id); continue }
      const { data: created, error } = await supabase.from('accounts').insert({ name: an, status: 'prospect', record_type: 'sales' }).select('id').single()
      if (error) throw new Error(`account "${an}": ${error.message}`)
      accountByName.set(an.toLowerCase(), created.id)
    }

    const out = []
    for (const r of recipients) {
      const email = r.email.trim().toLowerCase()
      if (!email) continue
      const accountId = r.account_id || (r.new_account_name ? accountByName.get(r.new_account_name.trim().toLowerCase()) : null) || null
      // Skip if a contact with this email already exists.
      const { data: existing } = await supabase.from('contacts').select('id, account_id').ilike('email', email).limit(1).maybeSingle()
      if (existing) {
        // Backfill account_id if it was unlinked.
        if (!existing.account_id && accountId) await supabase.from('contacts').update({ account_id: accountId }).eq('id', existing.id)
        continue
      }
      const name = r.name?.trim() || email.split('@')[0]
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({ name, email, account_id: accountId, status: 'lead' })
        .select('id, name, email, account_id')
        .single()
      if (error) throw new Error(`contact "${email}": ${error.message}`)
      out.push(contact)
    }

    return NextResponse.json({ contacts: out }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create contacts' }, { status: 500 })
  }
}
