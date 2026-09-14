// Pure remittance-account logic shared by the Settings UI (client), the API
// routes (server) and the PDF/email renderers: rail field specs, validators
// (IBAN mod-97, BIC shape, ABA routing checksum), masking and display fields.
// No IO, no Supabase — keep it testable and bundle-safe on the client.

import type { RemittanceAccount, RemittanceRail } from '@/lib/types'

export const REMITTANCE_CURRENCIES = ['GBP', 'EUR', 'USD'] as const
export const REMITTANCE_RAILS: RemittanceRail[] = ['uk_local', 'sepa', 'swift', 'us_local']

export const RAIL_LABELS: Record<RemittanceRail, string> = {
  uk_local: 'UK bank transfer',
  sepa: 'SEPA (EUR)',
  swift: 'International wire (SWIFT)',
  us_local: 'US domestic (ACH)',
}

/** Which entry fields each rail uses, in form order. beneficiary_name and label always apply. */
export const RAIL_FIELDS: Record<RemittanceRail, string[]> = {
  uk_local: ['beneficiary_name', 'beneficiary_address', 'bank_name', 'bank_address', 'sort_code', 'account_number'],
  sepa: ['beneficiary_name', 'beneficiary_address', 'bank_name', 'bank_address', 'iban', 'bic'],
  swift: ['beneficiary_name', 'beneficiary_address', 'bank_name', 'bank_address', 'iban', 'bic', 'intermediary_bic'],
  us_local: ['beneficiary_name', 'beneficiary_address', 'bank_name', 'bank_address', 'routing_number', 'account_number', 'account_type'],
}

/** Uppercase, spaces stripped — the stored form of an IBAN. */
export function normaliseIban(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '')
}

/** ISO 13616 mod-97 check. Structure (2 letters, 2 digits, 11-30 alphanumerics) plus checksum === 1. */
export function ibanValid(raw: string): boolean {
  const iban = normaliseIban(raw)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const v = ch >= '0' && ch <= '9' ? ch : String(ch.charCodeAt(0) - 55)
    for (const digit of v) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/

export function bicValid(raw: string): boolean {
  return BIC_RE.test(raw.toUpperCase().trim())
}

/** ABA routing number: 9 digits, weighted 3-7-1 checksum divisible by 10. */
export function routingNumberValid(raw: string): boolean {
  const rn = raw.trim()
  if (!/^\d{9}$/.test(rn)) return false
  const d = rn.split('').map(Number)
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])
  return sum % 10 === 0
}

/** UK sort code: 6 digits, hyphens/spaces tolerated on entry. */
export function sortCodeValid(raw: string): boolean {
  return /^\d{6}$/.test(raw.replace(/[-\s]/g, ''))
}

/** Last 4 visible only, for list views. */
export function maskNumber(value: string | null | undefined): string {
  const v = (value ?? '').replace(/\s+/g, '')
  if (!v) return ''
  return v.length <= 4 ? '••••' : `••••${v.slice(-4)}`
}

/** IBANs print in 4-character groups for readability; stored unspaced. */
export function formatIbanGroups(iban: string): string {
  return normaliseIban(iban).replace(/(.{4})/g, '$1 ').trim()
}

/**
 * Validate a payload for its rail. Returns field-keyed errors; empty object =
 * valid. Shared verbatim between the browser form and the API routes so the
 * two can never disagree.
 */
export function validateRemittanceAccount(input: {
  rail: RemittanceRail
  label?: string | null
  beneficiary_name?: string | null
  iban?: string | null
  bic?: string | null
  intermediary_bic?: string | null
  sort_code?: string | null
  account_number?: string | null
  routing_number?: string | null
}): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!input.label?.trim()) errors.label = 'Label is required'
  if (!input.beneficiary_name?.trim()) errors.beneficiary_name = 'Beneficiary name is required'
  const fields = RAIL_FIELDS[input.rail]
  if (!fields) {
    errors.rail = 'Unknown rail'
    return errors
  }
  if (fields.includes('iban')) {
    if (!input.iban?.trim()) errors.iban = 'IBAN is required for this rail'
    else if (!ibanValid(input.iban)) errors.iban = 'IBAN failed the mod-97 checksum'
  }
  if (fields.includes('bic')) {
    if (!input.bic?.trim()) errors.bic = 'BIC is required for this rail'
    else if (!bicValid(input.bic)) errors.bic = 'BIC must be 8 or 11 characters (e.g. NWBKGB2L)'
  }
  if (input.intermediary_bic?.trim() && !bicValid(input.intermediary_bic)) {
    errors.intermediary_bic = 'Intermediary BIC must be 8 or 11 characters'
  }
  if (fields.includes('sort_code')) {
    if (!input.sort_code?.trim()) errors.sort_code = 'Sort code is required'
    else if (!sortCodeValid(input.sort_code)) errors.sort_code = 'Sort code must be 6 digits'
  }
  if (fields.includes('account_number')) {
    if (!input.account_number?.trim()) errors.account_number = 'Account number is required'
  }
  if (fields.includes('routing_number')) {
    if (!input.routing_number?.trim()) errors.routing_number = 'Routing number is required'
    else if (!routingNumberValid(input.routing_number)) errors.routing_number = 'Routing number must be 9 digits and pass the ABA checksum'
  }
  return errors
}

/** SWIFT wires must arrive in full; correspondent deductions stay payable. */
export const OUR_CHARGES_LINE =
  'Please instruct your bank to send the full invoice amount with all transfer charges paid by the sender (OUR). Any correspondent bank deductions remain payable.'

/**
 * The labelled key/value pairs a rendered block shows for an account, in
 * print order. One function feeds the PDF, the email and the tests, so the
 * three can never disagree.
 */
export function remittanceDisplayFields(a: RemittanceAccount): Array<[string, string]> {
  const rows: Array<[string, string]> = [['Account name', a.beneficiary_name]]
  switch (a.rail) {
    case 'uk_local':
      if (a.sort_code) rows.push(['Sort code', a.sort_code.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3')])
      if (a.account_number) rows.push(['Account number', a.account_number])
      break
    case 'sepa':
      if (a.iban) rows.push(['IBAN', formatIbanGroups(a.iban)])
      if (a.bic) rows.push(['BIC/SWIFT', a.bic])
      break
    case 'swift':
      if (a.iban) rows.push(['IBAN', formatIbanGroups(a.iban)])
      if (a.bic) rows.push(['BIC/SWIFT', a.bic])
      if (a.intermediary_bic) rows.push(['Intermediary BIC', a.intermediary_bic])
      if (a.bank_name) rows.push(['Bank name', a.bank_name])
      if (a.bank_address) rows.push(['Bank address', a.bank_address])
      break
    case 'us_local':
      if (a.routing_number) rows.push(['Routing number (ACH)', a.routing_number])
      if (a.account_number) rows.push(['Account number', a.account_number])
      if (a.account_type) rows.push(['Account type', a.account_type])
      if (a.bank_name) rows.push(['Bank name', a.bank_name])
      if (a.bank_address) rows.push(['Bank address', a.bank_address])
      break
  }
  return rows
}
