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
>

function contactHasOwnAddress(contact: Contact | null | undefined) {
  return Boolean(
    contact?.address_line1 ||
      contact?.address_line2 ||
      contact?.city ||
      contact?.postcode ||
      contact?.country
  )
}

export function deriveInvoiceBillTo(
  account: Account | null | undefined,
  contact: Contact | null | undefined
): InvoiceBillToFields {
  const addressSource = contactHasOwnAddress(contact) ? contact : account

  return {
    bill_to_name: account?.name ?? contact?.company ?? contact?.name ?? null,
    bill_to_address:
      [addressSource?.address_line1, addressSource?.address_line2]
        .filter(Boolean)
        .join('\n') || null,
    bill_to_city: addressSource?.city ?? null,
    bill_to_postcode: addressSource?.postcode ?? null,
    bill_to_country: addressSource?.country ?? null,
    bill_to_email: contact?.email ?? null,
    bill_to_phone: contact?.phone ?? null,
  }
}

export function getInvoiceBillToDisplay(
  invoice: Pick<
    Invoice,
    | 'bill_to_name'
    | 'bill_to_address'
    | 'bill_to_city'
    | 'bill_to_postcode'
    | 'bill_to_country'
    | 'bill_to_email'
    | 'bill_to_phone'
  >,
  fallbackContact?: Contact | null,
  fallbackAccount?: Account | null | undefined
) {
  const fallback = deriveInvoiceBillTo(fallbackAccount, fallbackContact)

  return {
    bill_to_name: invoice.bill_to_name ?? fallback.bill_to_name,
    bill_to_address: invoice.bill_to_address ?? fallback.bill_to_address,
    bill_to_city: invoice.bill_to_city ?? fallback.bill_to_city,
    bill_to_postcode: invoice.bill_to_postcode ?? fallback.bill_to_postcode,
    bill_to_country: invoice.bill_to_country ?? fallback.bill_to_country,
    bill_to_email: invoice.bill_to_email ?? fallback.bill_to_email,
    bill_to_phone: invoice.bill_to_phone ?? fallback.bill_to_phone,
  }
}