import { NextResponse } from 'next/server'
import type { Contact, EmailLog } from '@/lib/types'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getEmailsForContact, parseGmailMessage } from '@/lib/google/gmail'

function normaliseHeaderEmail(value?: string) {
  if (!value) {
    return ''
  }

  const match = value.match(/<([^>]+)>/)
  return (match?.[1] ?? value).trim().toLowerCase()
}

function toEmailLogRow(
  parsed: Partial<EmailLog>,
  contact: Contact
): Record<string, unknown> | null {
  if (!parsed.gmail_message_id) {
    return null
  }

  const contactEmail = contact.email?.trim().toLowerCase()
  if (!contactEmail) {
    return null
  }

  const fromAddress = parsed.from_address ?? ''
  const toAddresses = parsed.to_addresses ?? []
  const inbound = normaliseHeaderEmail(fromAddress) === contactEmail

  return {
    gmail_message_id: parsed.gmail_message_id,
    gmail_thread_id: parsed.gmail_thread_id ?? null,
    account_id: contact.account_id,
    contact_id: contact.id,
    enquiry_id: null,
    quote_id: null,
    direction: inbound ? 'inbound' : 'outbound',
    from_address: fromAddress,
    to_addresses: toAddresses,
    subject: parsed.subject ?? '',
    snippet: parsed.snippet ?? null,
    body_html: parsed.body_html ?? null,
    received_at: inbound ? parsed.received_at ?? null : null,
    sent_at: inbound ? null : parsed.received_at ?? null,
  }
}

export async function POST() {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  try {
    const { data: contacts, error: contactsError } = await auth.supabase
      .from('contacts')
      .select('id, account_id, email')
      .not('email', 'is', null)
      .limit(50)

    if (contactsError) {
      throw new Error(contactsError.message)
    }

    let synced = 0
    const rowsToUpsert: Record<string, unknown>[] = []

    for (const contact of (contacts ?? []) as Pick<Contact, 'id' | 'account_id' | 'email'>[]) {
      if (!contact.email) {
        continue
      }

      const messages = await getEmailsForContact(contact.email, 10)
      for (const message of messages) {
        const row = toEmailLogRow(parseGmailMessage(message), contact as Contact)
        if (!row) {
          continue
        }

        rowsToUpsert.push(row)
        synced += 1
      }
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await auth.supabase
        .from('email_logs')
        .upsert(rowsToUpsert, { onConflict: 'gmail_message_id' })

      if (upsertError) {
        throw new Error(upsertError.message)
      }
    }

    return NextResponse.json({ synced })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync Gmail messages' },
      { status: 500 }
    )
  }
}
