'use client'

import { useActionState, useState } from 'react'
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
  const [sig, setSig] = useState(company.email_signature ?? '')

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
          <span className="font-medium text-[#9CA3AF]">Email signature (HTML)</span>
          <textarea
            name="email_signature"
            value={sig}
            onChange={(e) => setSig(e.target.value)}
            rows={6}
            placeholder={'<strong>Rob Harvey</strong><br>Trailhead Holdings Ltd<br><a href="mailto:rob@trailheadholdings.uk">rob@trailheadholdings.uk</a>'}
            className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 font-mono text-sm text-white"
          />
          <span className="text-xs text-[#9CA3AF]">
            HTML — supports links, bold, images (e.g. <code>&lt;img src=&quot;https://…/logo.png&quot;&gt;</code>). Appended to emails you compose and reply to in the Inbox.
          </span>
          {sig.trim() ? (
            <div className="rounded-2xl border border-[#2A2A3A] bg-[#13131E] p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-[#9CA3AF]">Preview</p>
              <div className="text-sm text-white" dangerouslySetInnerHTML={{ __html: sig }} />
            </div>
          ) : null}
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