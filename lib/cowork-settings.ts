import {
  CoworkApiError,
  noRecognisedFieldsError,
  optionalNumber,
  optionalString,
  parseBooleanBody,
} from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { getCompanySettings } from '@/lib/company-settings'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Company settings for the Cowork REST API and the MCP server — same contract as
 * lib/cowork-projects.ts.
 *
 * Bank and payment details (and the free-text payment_terms that prints beside
 * them on every invoice) are UI-only: a token that can rewrite where clients send
 * money is an invoice-fraud path. Any such key in a PATCH is a 400 that names it,
 * and nothing in the request is written.
 */

/** The accepted-field list quoted back on a no-recognised-fields 400. */
export const SETTINGS_PATCH_FIELDS = [
  'company_name',
  'address_line1',
  'address_line2',
  'city',
  'postcode',
  'country',
  'company_email',
  'company_number',
  'email_signature',
  'vat_registered',
  'vat_number',
  'default_payment_terms_days',
]

/** Columns (and GET-shape aliases) that only the settings page may write. */
const PAYMENT_DETAIL_FIELDS = new Set([
  'bank_name',
  'bank_account_name',
  'bank_sort_code',
  'bank_account_number',
  'bank_iban',
  'bank_bic',
  'payment_terms',
  'payment',
  'account_name',
  'sort_code',
  'account_number',
  'iban',
  'bic',
  'swift',
])
const PAYMENT_DETAIL_RE = /bank|iban|swift|bic|sort_?code|account_?(number|name|no)|routing/i

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** GET /api/cowork/settings. Bank details are readable (they print on invoices). */
export async function getCoworkSettings() {
  const settings = await getCompanySettings(supabaseService)
  return {
    company: {
      name: settings.company_name,
      address_line1: settings.address_line1,
      address_line2: settings.address_line2,
      city: settings.city,
      postcode: settings.postcode,
      country: settings.country,
      email: settings.company_email,
      company_number: settings.company_number,
      email_signature: settings.email_signature,
      vat_registered: settings.vat_registered,
      vat_number: settings.vat_number,
      default_payment_terms_days: settings.default_payment_terms_days,
    },
    payment: {
      bank_name: settings.bank_name,
      account_name: settings.bank_account_name,
      sort_code: settings.bank_sort_code,
      account_number: settings.bank_account_number,
      iban: settings.bank_iban,
      bic: settings.bank_bic,
      payment_terms: settings.payment_terms,
    },
  }
}

/** PATCH /api/cowork/settings and the MCP `update_settings` tool. */
export async function updateCoworkSettings(body: Record<string, unknown>) {
  const refused = Object.keys(body).filter((key) => PAYMENT_DETAIL_FIELDS.has(key) || PAYMENT_DETAIL_RE.test(key))
  if (refused.length > 0) {
    throw new CoworkApiError(
      `Bank and payment details can only be changed on the Settings page, not over the API: ${refused.join(', ')}`,
      400,
      { refused }
    )
  }

  const patch: Record<string, unknown> = {}

  if (body.company_name !== undefined) {
    const name = optionalString(body.company_name)
    if (!name) throw new CoworkApiError('company_name must be a non-empty string', 400)
    patch.company_name = name
  }
  for (const key of ['address_line1', 'address_line2', 'city', 'postcode', 'country', 'company_number', 'email_signature', 'vat_number']) {
    if (body[key] !== undefined) patch[key] = optionalString(body[key])
  }
  if (body.company_email !== undefined) {
    const email = optionalString(body.company_email)
    if (email && !EMAIL_RE.test(email)) throw new CoworkApiError('company_email must be a valid email address', 400)
    patch.company_email = email
  }
  if (body.vat_registered !== undefined) {
    const registered = parseBooleanBody(body.vat_registered, 'vat_registered')
    if (registered === undefined) throw new CoworkApiError('vat_registered must be a boolean', 400)
    patch.vat_registered = registered
  }
  // Same bounds as the settings page: a whole number of days, 0–365.
  if (body.default_payment_terms_days !== undefined) {
    const days = optionalNumber(body.default_payment_terms_days, 'default_payment_terms_days')
    if (days === null || !Number.isInteger(days) || days > 365) {
      throw new CoworkApiError('default_payment_terms_days must be a whole number of days between 0 and 365', 400)
    }
    patch.default_payment_terms_days = days
  }

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) throw noRecognisedFieldsError(body, SETTINGS_PATCH_FIELDS)
    throw new CoworkApiError('No changes supplied', 400)
  }

  const { data: prior } = await supabaseService
    .from('os_company_settings')
    .select(Object.keys(patch).join(', '))
    .eq('key', 'default')
    .maybeSingle()

  const { error } = await supabaseService
    .from('os_company_settings')
    .upsert({ key: 'default', ...patch, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new CoworkApiError(error.message || 'Failed to update settings', 500)

  void recordCoworkWrite({
    action: 'update',
    entity: 'company_settings',
    entityId: null,
    entityLabel: 'Company settings',
    summary: `Updated company settings (${Object.keys(patch).join(', ')})`,
    before: prior ?? null,
    payload: patch,
  })
  return getCoworkSettings()
}
