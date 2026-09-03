import type { SupabaseClient } from '@supabase/supabase-js'

export type CompanySettings = {
  company_name: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postcode: string | null
  country: string | null
  company_email: string | null
  company_number: string | null
  email_signature: string | null
  bank_name: string | null
  bank_account_name: string | null
  bank_sort_code: string | null
  bank_account_number: string | null
  bank_iban: string | null
  bank_bic: string | null
  payment_terms: string | null
  vat_registered: boolean
  vat_number: string | null
  default_payment_terms_days: number
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  company_name: 'Trailhead Holdings Ltd',
  address_line1: null,
  address_line2: null,
  city: 'Brentwood, Essex',
  postcode: null,
  country: 'United Kingdom',
  company_email: 'info@trailheadholdings.uk',
  company_number: '16910286',
  email_signature: null,
  bank_name: null,
  bank_account_name: null,
  bank_sort_code: null,
  bank_account_number: null,
  bank_iban: null,
  bank_bic: null,
  payment_terms: null,
  vat_registered: false,
  vat_number: null,
  default_payment_terms_days: 14,
}

const COMPANY_SETTINGS_FIELDS =
  'company_name, address_line1, address_line2, city, postcode, country, company_email, company_number, email_signature, bank_name, bank_account_name, bank_sort_code, bank_account_number, bank_iban, bank_bic, payment_terms, vat_registered, vat_number, default_payment_terms_days'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function withFallback(value: string | null | undefined, fallback: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

export async function getCompanySettings(supabase: SupabaseClient): Promise<CompanySettings> {
  const { data, error } = await supabase
    .from('os_company_settings')
    .select(COMPANY_SETTINGS_FIELDS)
    .eq('key', 'default')
    .maybeSingle()

  if (error || !data) {
    return DEFAULT_COMPANY_SETTINGS
  }

  return {
    company_name: withFallback(data.company_name, DEFAULT_COMPANY_SETTINGS.company_name) ?? DEFAULT_COMPANY_SETTINGS.company_name,
    address_line1: withFallback(data.address_line1, DEFAULT_COMPANY_SETTINGS.address_line1),
    address_line2: withFallback(data.address_line2, DEFAULT_COMPANY_SETTINGS.address_line2),
    city: withFallback(data.city, DEFAULT_COMPANY_SETTINGS.city),
    postcode: withFallback(data.postcode, DEFAULT_COMPANY_SETTINGS.postcode),
    country: withFallback(data.country, DEFAULT_COMPANY_SETTINGS.country),
    company_email: withFallback(data.company_email, DEFAULT_COMPANY_SETTINGS.company_email),
    company_number: withFallback(data.company_number, DEFAULT_COMPANY_SETTINGS.company_number),
    email_signature: withFallback(data.email_signature, null),
    bank_name: withFallback(data.bank_name, null),
    bank_account_name: withFallback(data.bank_account_name, null),
    bank_sort_code: withFallback(data.bank_sort_code, null),
    bank_account_number: withFallback(data.bank_account_number, null),
    bank_iban: withFallback(data.bank_iban, null),
    bank_bic: withFallback(data.bank_bic, null),
    payment_terms: withFallback(data.payment_terms, null),
    vat_registered: data.vat_registered ?? false,
    vat_number: withFallback(data.vat_number, null),
    default_payment_terms_days: Number.isFinite(Number(data.default_payment_terms_days)) && Number(data.default_payment_terms_days) > 0 ? Number(data.default_payment_terms_days) : 14,
  }
}

export type CompanyBankAccount = {
  currency: string
  account_name: string | null
  bank_name: string | null
  account_number: string | null
  sort_code: string | null
  iban: string | null
  bic: string | null
  bank_address: string | null
}

/** Bank account to display for a given invoice currency, or null if none set.
 * GBP falls back to the legacy fields on os_company_settings via the PDF. */
export async function getBankAccountForCurrency(
  currency: string,
  supabase: SupabaseClient
): Promise<CompanyBankAccount | null> {
  const { data } = await supabase
    .from('company_bank_accounts')
    .select('currency, account_name, bank_name, account_number, sort_code, iban, bic, bank_address')
    .eq('currency', currency)
    .maybeSingle()
  return (data as CompanyBankAccount | null) ?? null
}

export function renderCompanyEmailFooterHtml(settings: CompanySettings) {
  const lines = [
    `<p style="margin:0"><strong>${escapeHtml(settings.company_name)}</strong></p>`,
  ]

  if (settings.address_line1) {
    lines.push(`<p style="margin:4px 0 0">${escapeHtml(settings.address_line1)}</p>`)
  }

  if (settings.address_line2) {
    lines.push(`<p style="margin:4px 0 0">${escapeHtml(settings.address_line2)}</p>`)
  }

  const locality = [settings.city, settings.postcode].filter(Boolean).join(' ')
  if (locality) {
    lines.push(`<p style="margin:4px 0 0">${escapeHtml(locality)}</p>`)
  }

  if (settings.country) {
    lines.push(`<p style="margin:4px 0 0">${escapeHtml(settings.country)}</p>`)
  }

  if (settings.company_number) {
    lines.push(
      `<p style="margin:4px 0 0">Registered in England &amp; Wales ${escapeHtml(settings.company_number)}</p>`
    )
  }

  if (settings.company_email) {
    lines.push(
      `<p style="margin:4px 0 0"><a href="mailto:${escapeHtml(settings.company_email)}" style="color:#0f172a;text-decoration:none">${escapeHtml(settings.company_email)}</a></p>`
    )
  }

  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;color:#475569;font-size:12px;line-height:1.6">
      ${lines.join('')}
    </div>
  `
}