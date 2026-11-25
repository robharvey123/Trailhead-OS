import { describe, expect, it } from 'vitest'
import { legacyBankLabel, resolveInvoiceRemittanceAccounts } from './remittance'
import type { RemittanceAccount } from './types'

function acct(over: Partial<RemittanceAccount>): RemittanceAccount {
  return {
    id: 'x', currency: 'GBP', rail: 'uk_local', label: 'Account', beneficiary_name: 'Trailhead Holdings Ltd',
    beneficiary_address: null, bank_name: null, bank_address: null, iban: null, bic: null, intermediary_bic: null,
    account_number: '12345678', sort_code: '112233', routing_number: null, account_type: null, notes: null,
    sort_order: 0, active: true, print_by_default: true, created_at: '', updated_at: '', ...over,
  }
}

const revolut = acct({ id: 'rev', label: 'Revolut', print_by_default: false })
const usdSwift = acct({ id: 'usd', currency: 'USD', rail: 'swift', label: 'USD wire' })

describe('resolveInvoiceRemittanceAccounts', () => {
  it('prints nothing extra on a GBP invoice with no choice when GBP accounts are pick-only', () => {
    expect(resolveInvoiceRemittanceAccounts({ currency: 'GBP' }, [revolut, usdSwift])).toEqual([])
  })

  it('prints only the chosen account', () => {
    const other = acct({ id: 'other', label: 'Other GBP' })
    expect(resolveInvoiceRemittanceAccounts({ currency: 'GBP', remittance_account_id: 'rev' }, [other, revolut])).toEqual([revolut])
  })

  it('ignores a choice from another currency and falls back to the defaults', () => {
    expect(resolveInvoiceRemittanceAccounts({ currency: 'USD', remittance_account_id: 'rev' }, [revolut, usdSwift])).toEqual([usdSwift])
  })

  it('ignores an inactive chosen account', () => {
    const inactive = { ...revolut, active: false }
    expect(resolveInvoiceRemittanceAccounts({ currency: 'GBP', remittance_account_id: 'rev' }, [inactive])).toEqual([])
  })
})

describe('legacyBankLabel', () => {
  it('formats the sort code and masks the account number', () => {
    expect(legacyBankLabel({ bank_name: null, bank_sort_code: '040605', bank_account_number: '12344482' })).toBe('Main account (04-06-05, ••••4482)')
  })
  it('returns null with no account number', () => {
    expect(legacyBankLabel({ bank_sort_code: '040605', bank_account_number: null })).toBeNull()
  })
})
