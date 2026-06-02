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
      className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
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
          <span className="font-medium text-[color:var(--text-2)]">Company name</span>
          <input
            name="company_name"
            defaultValue={company.company_name}
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[color:var(--text-2)]">Address line 1</span>
          <input
            name="address_line1"
            defaultValue={company.address_line1 ?? ''}
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[color:var(--text-2)]">Address line 2</span>
          <input
            name="address_line2"
            defaultValue={company.address_line2 ?? ''}
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">City / area</span>
          <input
            name="city"
            defaultValue={company.city ?? ''}
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">Postcode</span>
          <input
            name="postcode"
            defaultValue={company.postcode ?? ''}
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">Country</span>
          <input
            name="country"
            defaultValue={company.country ?? ''}
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">Company email</span>
          <input
            name="company_email"
            type="email"
            defaultValue={company.company_email ?? ''}
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[color:var(--text-2)]">Company registration number</span>
          <input
            name="company_number"
            defaultValue={company.company_number ?? ''}
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[color:var(--text-2)]">Email signature (HTML)</span>
          <textarea
            name="email_signature"
            value={sig}
            onChange={(e) => setSig(e.target.value)}
            rows={6}
            placeholder={'<strong>Rob Harvey</strong><br>Trailhead Holdings Ltd<br><a href="mailto:rob@trailheadholdings.uk">rob@trailheadholdings.uk</a>'}
            className="os-textarea w-full rounded-2xl px-4 py-3 font-mono text-sm"
          />
          <span className="text-xs text-[color:var(--text-3)]">
            HTML — supports links, bold, images (e.g. <code>&lt;img src=&quot;https://…/logo.png&quot;&gt;</code>). Appended to emails you compose and reply to in the Inbox.
          </span>
          {sig.trim() ? (
            <div className="os-card p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-[color:var(--text-3)]">Preview</p>
              <div className="text-sm text-[color:var(--text)]" dangerouslySetInnerHTML={{ __html: sig }} />
            </div>
          ) : null}
        </label>
      </div>

      <p className="text-sm text-[color:var(--text-2)]">
        These details are appended to invoice, quote, and enquiry emails sent from Trailhead OS.
      </p>

      <div className="flex items-center justify-between gap-4">
        <div>
          {state.error ? <p className="text-sm text-[color:var(--red-strong)]">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-[color:var(--emerald-strong)]">Footer details saved.</p> : null}
        </div>
        <SubmitButton />
      </div>
    </form>
  )
}