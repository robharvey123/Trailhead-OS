import type { Account, Contact, Invoice } from '@/lib/types'

export type InvoiceBillToFields = Pick<
  Invoice,
  | 'bill_to_name'
  | 'bill_to_address'
  | 'bill_to_city'
  | 'bill_to_postcode'
  | 'bill_to_country'
  | 'bill_to_email'
  | 'bill_to_phone'
  | 'bill_to_vat_number'
  | 'bill_to_company_number'
>

const BILL_TO_KEYS = [
  'bill_to_name',
  'bill_to_address',
  'bill_to_city',
  'bill_to_postcode',
  'bill_to_country',
  'bill_to_email',
  'bill_to_phone',
  'bill_to_vat_number',
  'bill_to_company_number',
] as const

function contactHasOwnAddress(contact: Contact | null | undefined) {
  // country alone doesn't count: contacts.country defaults to 'UK' in the DB, so
  // every contact would "have an address" and the account path would never run.
  return Boolean(contact?.address_line1 || contact?.address_line2 || contact?.city || contact?.postcode)
}

function accountHasStructuredAddress(account: Account | null | undefined) {
  return Boolean(account?.address_line1 || account?.address_line2 || account?.city || account?.postcode)
}

const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

/**
 * Most CRM accounts carry only a free-text `hq_address`. Split it on newlines
 * (or commas when it is a single line) into address + city + postcode where
 * that parses cleanly; otherwise the whole string goes into the address so
 * nothing is lost.
 */
function parseHqAddress(hq: string): { address: string | null; city: string | null; postcode: string | null } {
  let parts = hq.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 1) parts = parts[0].split(/,\s*/).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return { address: hq.trim() || null, city: null, postcode: null }

  let postcode: string | null = null
  const last = parts[parts.length - 1]
  if (UK_POSTCODE_RE.test(last)) {
    postcode = last
    parts = parts.slice(0, -1)
  } else {
    // "Brentwood CM14 4AB" as the final segment.
    const m = /^(.*)\s([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i.exec(last)
    if (m) {
      postcode = m[2]
      parts = [...parts.slice(0, -1), m[1].trim()].filter(Boolean)
    }
  }

  const city = parts.length >= 2 ? parts[parts.length - 1] : null
  const address = (city ? parts.slice(0, -1) : parts).join('\n') || null
  return { address, city, postcode }
}

export function deriveInvoiceBillTo(
  account: Account | null | undefined,
  contact: Contact | null | undefined
): InvoiceBillToFields {
  // Address precedence: contact's own address → account structured address →
  // account.hq_address parsed → nothing.
  let address: string | null = null
  let city: string | null = null
  let postcode: string | null = null
  let country: string | null = null

  if (contactHasOwnAddress(contact)) {
    address = [contact?.address_line1, contact?.address_line2].filter(Boolean).join('\n') || null
    city = contact?.city ?? null
    postcode = contact?.postcode ?? null
    country = contact?.country ?? null
  } else if (accountHasStructuredAddress(account)) {
    address = [account?.address_line1, account?.address_line2].filter(Boolean).join('\n') || null
    city = account?.city ?? null
    postcode = account?.postcode ?? null
    country = account?.country ?? null
  } else if (account?.hq_address?.trim()) {
    const parsed = parseHqAddress(account.hq_address)
    address = parsed.address
    city = parsed.city
    postcode = parsed.postcode
    country = account?.country ?? null
  } else {
    country = account?.country ?? contact?.country ?? null
  }

  return {
    bill_to_name: account?.name ?? contact?.company ?? contact?.name ?? null,
    bill_to_address: address,
    bill_to_city: city,
    bill_to_postcode: postcode,
    bill_to_country: country,
    bill_to_email: contact?.email ?? account?.billing_email ?? account?.email_contact ?? null,
    bill_to_phone: contact?.phone ?? null,
    bill_to_vat_number: account?.vat_number ?? null,
    bill_to_company_number: account?.company_number ?? null,
  }
}

export function getInvoiceBillToDisplay(
  invoice: Partial<InvoiceBillToFields>,
  fallbackContact?: Contact | null,
  fallbackAccount?: Account | null | undefined
): InvoiceBillToFields {
  const fallback = deriveInvoiceBillTo(fallbackAccount, fallbackContact)
  const out = {} as Record<(typeof BILL_TO_KEYS)[number], string | null>
  for (const key of BILL_TO_KEYS) out[key] = invoice[key] ?? fallback[key] ?? null
  return out
}
