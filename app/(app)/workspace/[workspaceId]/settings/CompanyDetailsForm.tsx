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
}

const initialState: SettingsState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70">
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
          <span className="font-medium text-slate-200">Company Name</span>
          <input name="company_name" defaultValue={company.company_name || ''} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">VAT / Tax Number</span>
          <input name="company_vat_number" defaultValue={company.company_vat_number || ''} placeholder="e.g. GB123456789" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-200">Address</span>
          <input name="company_address" defaultValue={company.company_address || ''} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">City</span>
          <input name="company_city" defaultValue={company.company_city || ''} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Postcode</span>
          <input name="company_postcode" defaultValue={company.company_postcode || ''} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Country</span>
          <input name="company_country" defaultValue={company.company_country || ''} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Email</span>
          <input name="company_email" type="email" defaultValue={company.company_email || ''} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Phone</span>
          <input name="company_phone" defaultValue={company.company_phone || ''} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
        </label>
      </div>
      <SubmitButton />
      {state.error && <p className="text-sm text-rose-200">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-200">Company details saved.</p>}
    </form>
  )
}
