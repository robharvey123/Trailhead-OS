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
      className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90 disabled:opacity-60"
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
          <span className="font-medium text-[#9CA3AF]">Company name</span>
          <input
            name="company_name"
            defaultValue={company.company_name}
            className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[#9CA3AF]">Address line 1</span>
          <input
            name="address_line1"
            defaultValue={company.address_line1 ?? ''}
            className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[#9CA3AF]">Address line 2</span>
          <input
            name="address_line2"
            defaultValue={company.address_line2 ?? ''}
            className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[#9CA3AF]">City / area</span>
          <input
            name="city"
            defaultValue={company.city ?? ''}
            className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[#9CA3AF]">Postcode</span>
          <input
            name="postcode"
            defaultValue={company.postcode ?? ''}
            className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[#9CA3AF]">Country</span>
          <input
            name="country"
            defaultValue={company.country ?? ''}
            className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[#9CA3AF]">Company email</span>
          <input
            name="company_email"
            type="email"
            defaultValue={company.company_email ?? ''}
            className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[#9CA3AF]">Company registration number</span>
          <input
            name="company_number"
            defaultValue={company.company_number ?? ''}
            className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[#9CA3AF]">Email signature</span>
          <textarea
            name="email_signature"
            defaultValue={company.email_signature ?? ''}
            rows={4}
            placeholder={'Rob Harvey\nTrailhead Holdings Ltd\nrob@trailheadholdings.uk'}
            className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
          />
          <span className="text-xs text-[#9CA3AF]">Appended to emails you compose and reply to in the Inbox.</span>
        </label>
      </div>

      <p className="text-sm text-[#9CA3AF]">
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