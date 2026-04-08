'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateOsCompanySettings, type CompanySettingsState } from '@/app/(os)/settings/actions'
import type { CompanySettings } from '@/lib/company-settings'

const initialState: CompanySettingsState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
    >
      {pending ? 'Saving...' : 'Save footer details'}
    </button>
  )
}

export default function CompanySettingsForm({ company }: { company: CompanySettings }) {
  const [state, formAction] = useActionState(updateOsCompanySettings, initialState)

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-200">Company name</span>
          <input
            name="company_name"
            defaultValue={company.company_name}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-200">Address line 1</span>
          <input
            name="address_line1"
            defaultValue={company.address_line1 ?? ''}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-200">Address line 2</span>
          <input
            name="address_line2"
            defaultValue={company.address_line2 ?? ''}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">City / area</span>
          <input
            name="city"
            defaultValue={company.city ?? ''}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Postcode</span>
          <input
            name="postcode"
            defaultValue={company.postcode ?? ''}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Country</span>
          <input
            name="country"
            defaultValue={company.country ?? ''}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Company email</span>
          <input
            name="company_email"
            type="email"
            defaultValue={company.company_email ?? ''}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-200">Company registration number</span>
          <input
            name="company_number"
            defaultValue={company.company_number ?? ''}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>
      </div>

      <p className="text-sm text-slate-400">
        These details are appended to invoice, quote, and enquiry emails sent from Trailhead OS.
      </p>

      <div className="flex items-center justify-between gap-4">
        <div>
          {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-emerald-300">Footer details saved.</p> : null}
        </div>
        <SubmitButton />
      </div>
    </form>
  )
}