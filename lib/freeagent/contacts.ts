import { createClient } from '@/lib/supabase/service'
import { faFetch } from './client'

/**
 * Map a Trailhead OS client (accounts row) to a FreeAgent contact, creating it on
 * demand. Idempotent: once accounts.freeagent_contact_url is set, it's returned.
 *
 * Source of truth is Trailhead OS at creation time only — later edits to the
 * client's address here do NOT push to FreeAgent (would need a PUT; out of scope).
 */
export async function ensureContact(accountId: string): Promise<string> {
  const supabase = createClient()
  const { data: account, error } = await supabase
    .from('accounts')
    .select('id, name, email_contact, address_line1, address_line2, city, postcode, country, freeagent_contact_url')
    .eq('id', accountId)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load account')
  if (!account) throw new Error('Account not found')
  if (account.freeagent_contact_url) return account.freeagent_contact_url as string

  // FreeAgent references contacts by URL; addresses use address1/2, town, postcode, country.
  const contact: Record<string, unknown> = { organisation_name: account.name }
  if (account.email_contact) contact.email = account.email_contact
  if (account.address_line1) contact.address1 = account.address_line1
  if (account.address_line2) contact.address2 = account.address_line2
  if (account.city) contact.town = account.city
  if (account.postcode) contact.postcode = account.postcode
  if (account.country) contact.country = account.country

  const res = await faFetch('/contacts', { method: 'POST', body: JSON.stringify({ contact }) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FreeAgent contact create failed (${res.status}): ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as { contact?: { url?: string } }
  const url = json.contact?.url
  if (!url) throw new Error('FreeAgent did not return a contact URL')

  await supabase.from('accounts').update({ freeagent_contact_url: url }).eq('id', accountId)
  return url
}
