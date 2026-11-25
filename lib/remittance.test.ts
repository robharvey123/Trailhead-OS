import { describe, expect, it } from 'vitest'
import { selectRemittanceAccountsForInvoice } from './remittance'
import type { RemittanceAccount } from './types'

function acct(id: string, print_by_default: boolean): RemittanceAccount {
  return {
    id,
    currency: 'GBP',
    rail: 'uk_local',
    label: id,
    beneficiary_name: 'Trailhead Holdings Ltd',
    beneficiary_address: null,
    bank_name: null,
    bank_address: null,
    iban: null,
    bic: null,
    intermediary_bic: null,
    account_number: '12345678',
    sort_code: '123456',
    routing_number: null,
    account_type: null,
    notes: null,
    sort_order: 0,
    active: true,
    print_by_default,
    created_at: '',
    updated_at: '',
  }
}

describe('selectRemittanceAccountsForInvoice', () => {
  const original = acct('original', true)
  const revolut = acct('revolut', false)

  it('prints only default accounts when the invoice has no choice', () => {
    expect(selectRemittanceAccountsForInvoice([original, revolut], {})).toEqual([original])
    expect(selectRemittanceAccountsForInvoice([original, revolut], { remittance_account_id: null })).toEqual([original])
  })

  it('returns nothing when only alternatives exist, so the legacy block prints', () => {
    expect(selectRemittanceAccountsForInvoice([revolut], {})).toEqual([])
  })

  it('prints only the chosen account', () => {
    expect(selectRemittanceAccountsForInvoice([original, revolut], { remittance_account_id: 'revolut' })).toEqual([revolut])
    expect(selectRemittanceAccountsForInvoice([original, revolut], { remittance_account_id: 'original' })).toEqual([original])
  })

  it('falls back to defaults when the chosen account is no longer active', () => {
    expect(selectRemittanceAccountsForInvoice([original], { remittance_account_id: 'revolut' })).toEqual([original])
  })

  it('treats rows without the flag as defaults', () => {
    const legacyRow = { ...acct('old', true), print_by_default: undefined } as unknown as RemittanceAccount
    expect(selectRemittanceAccountsForInvoice([legacyRow], {})).toEqual([legacyRow])
  })
})
