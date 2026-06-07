import { createClient } from '@/lib/supabase/service'
import { faFetch } from './client'

type ContactDetails = {
  organisation_name?: string
  first_name?: string
  last_name?: string
  email?: string
  address1?: string
  address2?: string
  town?: string
  postcode?: string
  country?: string
}

// FreeAgent wants full country names; map the common abbreviations we store.
function normalizeCountry(c?: string | null): string | undefined {
  if (!c) return undefined
  const v = c.trim()
  const map: Record<string, string> = { UK: 'United Kingdom', GB: 'United Kingdom', US: 'United States', USA: 'United States' }
  return map[v.toUpperCase()] ?? v
}

/** Low-level: create a FreeAgent contact, return its URL. */
async function createFreeAgentContact(details: ContactDetails): Promise<string> {
  const contact: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(details)) if (v) contact[k] = v
  if (!contact.organisation_name && !contact.first_name && !contact.last_name) {
    throw new Error('No contact name available to create a FreeAgent contact.')
  }
  const res = await faFetch('/contacts', { method: 'POST', body: JSON.stringify({ contact }) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FreeAgent contact create failed (${res.status}): ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as { contact?: { url?: string } }
  const url = json.contact?.url
  if (!url) throw new Error('FreeAgent did not return a contact URL')
  return url
}

/** Map a client (accounts row) to a FreeAgent contact, created + cached on demand. */
export async function ensureContactForAccount(accountId: string): Promise<string> {
  const supabase = createClient()
  const { data: a, error } = await supabase
    .from('accounts')
    .select('id, name, email_contact, address_line1, address_line2, city, postcode, country, freeagent_contact_url')
    .eq('id', accountId)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load account')
  if (!a) throw new Error('Account not found')
  if (a.freeagent_contact_url) return a.freeagent_contact_url as string

  const url = await createFreeAgentContact({
    organisation_name: a.name as string,
    email: (a.email_contact as string | null) ?? undefined,
    address1: (a.address_line1 as string | null) ?? undefined,
    address2: (a.address_line2 as string | null) ?? undefined,
    town: (a.city as string | null) ?? undefined,
    postcode: (a.postcode as string | null) ?? undefined,
    country: normalizeCountry(a.country as string | null),
  })
  await supabase.from('accounts').update({ freeagent_contact_url: url }).eq('id', accountId)
  return url
}

/** Map a CRM contact to a FreeAgent contact. Prefers the contact's account if set;
 *  else creates from the contact and caches on the contact row. Returns null if the
 *  contact no longer exists. */
async function ensureContactForContact(contactId: string): Promise<string | null> {
  const supabase = createClient()
  const { data: c } = await supabase
    .from('contacts')
    .select('id, name, company, email, account_id, address_line1, address_line2, city, postcode, country, freeagent_contact_url')
    .eq('id', contactId)
    .maybeSingle()
  if (!c) return null
  if (c.account_id) return ensureContactForAccount(c.account_id as string)
  if (c.freeagent_contact_url) return c.freeagent_contact_url as string

  const nameParts = String(c.name ?? '').trim().split(/\s+/)
  const url = await createFreeAgentContact({
    organisation_name: (c.company as string | null) ?? undefined,
    first_name: c.company ? undefined : nameParts[0] || undefined,
    last_name: c.company ? undefined : nameParts.slice(1).join(' ') || undefined,
    email: (c.email as string | null) ?? undefined,
    address1: (c.address_line1 as string | null) ?? undefined,
    address2: (c.address_line2 as string | null) ?? undefined,
    town: (c.city as string | null) ?? undefined,
    postcode: (c.postcode as string | null) ?? undefined,
    country: normalizeCountry(c.country as string | null),
  })
  await supabase.from('contacts').update({ freeagent_contact_url: url }).eq('id', contactId)
  return url
}

export type InvoiceContactSource = {
  account_id: string | null
  contact_id: string | null
  bill_to_name: string | null
  bill_to_email: string | null
  bill_to_address: string | null
  bill_to_city: string | null
  bill_to_postcode: string | null
  bill_to_country: string | null
}

/**
 * Resolve a FreeAgent contact URL for an invoice, in order of reliability:
 * account → contact (→ its account, or the contact itself) → bill-to details.
 * The bill-to fallback creates an ad-hoc FreeAgent contact (nothing to cache it
 * on); fine because each invoice only pushes once.
 */
export async function resolveInvoiceContactUrl(inv: InvoiceContactSource): Promise<string> {
  if (inv.account_id) return ensureContactForAccount(inv.account_id)
  if (inv.contact_id) {
    const url = await ensureContactForContact(inv.contact_id)
    if (url) return url
  }
  if (inv.bill_to_name) {
    return createFreeAgentContact({
      organisation_name: inv.bill_to_name,
      email: inv.bill_to_email ?? undefined,
      address1: inv.bill_to_address ?? undefined,
      town: inv.bill_to_city ?? undefined,
      postcode: inv.bill_to_postcode ?? undefined,
      country: normalizeCountry(inv.bill_to_country),
    })
  }
  throw new Error('This invoice has no client account, contact, or billing name to map to a FreeAgent contact.')
}
