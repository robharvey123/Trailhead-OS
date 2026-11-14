'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateCompanyDetails } from './actions'
import type { SettingsState } from './actions'

type CompanyFields = {
  company_name: string | null
  company_address: string | null
  company_city: string | null
  company_postcode: string | null
  company_country: string | null
  company_email: string | null
  company_phone: string | null
  company_vat_number: string | null
  company_number: string | null
  bank_name: string | null
  bank_account_name: string | null
  bank_sort_code: string | null
  bank_account_number: string | null
  bank_iban: string | null
  bank_swift: string | null
}

const initialState: SettingsState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? 'Saving...' : 'Save company details'}
    </button>
  )
}

export default function CompanyDetailsForm({ workspaceId, company }: { workspaceId: string; company: CompanyFields }) {
  const [state, formAction] = useActionState(updateCompanyDetails, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Company Name</span>
          <input name="company_name" defaultValue={company.company_name || ''} className="os-input w-full px-3 py-2 text-sm" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">VAT / Tax Number</span>
          <input name="company_vat_number" defaultValue={company.company_vat_number || ''} placeholder="e.g. GB123456789" className="os-input w-full px-3 py-2 text-sm" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Company Number</span>
          <input name="company_number" defaultValue={company.company_number || ''} placeholder="e.g. 12345678" className="os-input w-full px-3 py-2 text-sm" />
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[var(--text)]">Address</span>
          <input name="company_address" defaultValue={company.company_address || ''} className="os-input w-full px-3 py-2 text-sm" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">City</span>
          <input name="company_city" defaultValue={company.company_city || ''} className="os-input w-full px-3 py-2 text-sm" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Postcode</span>
          <input name="company_postcode" defaultValue={company.company_postcode || ''} className="os-input w-full px-3 py-2 text-sm" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Country</span>
          <input name="company_country" defaultValue={company.company_country || ''} className="os-input w-full px-3 py-2 text-sm" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Email</span>
          <input name="company_email" type="email" defaultValue={company.company_email || ''} className="os-input w-full px-3 py-2 text-sm" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Phone</span>
          <input name="company_phone" defaultValue={company.company_phone || ''} className="os-input w-full px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-6 border-t border-[var(--border)] pt-6">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Bank Account Details</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--text)]">Bank Name</span>
            <input name="bank_name" defaultValue={company.bank_name || ''} placeholder="e.g. Barclays" className="os-input w-full px-3 py-2 text-sm" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--text)]">Account Name</span>
            <input name="bank_account_name" defaultValue={company.bank_account_name || ''} placeholder="e.g. Trailhead Holdings Ltd" className="os-input w-full px-3 py-2 text-sm" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--text)]">Sort Code</span>
            <input name="bank_sort_code" defaultValue={company.bank_sort_code || ''} placeholder="e.g. 20-00-00" className="os-input w-full px-3 py-2 text-sm" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--text)]">Account Number</span>
            <input name="bank_account_number" defaultValue={company.bank_account_number || ''} placeholder="e.g. 12345678" className="os-input w-full px-3 py-2 text-sm" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--text)]">IBAN</span>
            <input name="bank_iban" defaultValue={company.bank_iban || ''} placeholder="e.g. GB00BARC20000012345678" className="os-input w-full px-3 py-2 text-sm" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--text)]">BIC / SWIFT</span>
            <input name="bank_swift" defaultValue={company.bank_swift || ''} placeholder="e.g. BARCGB22" className="os-input w-full px-3 py-2 text-sm" />
          </label>
        </div>
      </div>
      <SubmitButton />
      {state.error && <p className="text-sm text-[var(--red-strong)]">{state.error}</p>}
      {state.success && <p className="text-sm text-[var(--emerald-strong)]">Company details saved.</p>}
    </form>
  )
}
