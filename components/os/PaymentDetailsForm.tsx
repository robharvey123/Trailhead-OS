'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateOsPaymentSettings, type PaymentSettingsState } from '@/app/(os)/settings/actions'
import type { CompanySettings } from '@/lib/company-settings'

const initialState: PaymentSettingsState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
    >
      {pending ? 'Saving...' : 'Save payment details'}
    </button>
  )
}

export default function PaymentDetailsForm({ company }: { company: CompanySettings }) {
  const [state, formAction] = useActionState(updateOsPaymentSettings, initialState)

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">Bank name</span>
          <input
            name="bank_name"
            defaultValue={company.bank_name ?? ''}
            placeholder="e.g. Barclays"
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">Account name</span>
          <input
            name="bank_account_name"
            defaultValue={company.bank_account_name ?? ''}
            placeholder="e.g. Trailhead Holdings Ltd"
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">Sort code</span>
          <input
            name="bank_sort_code"
            defaultValue={company.bank_sort_code ?? ''}
            placeholder="12-34-56"
            pattern="\d{2}-?\d{2}-?\d{2}"
            title="6 digits, e.g. 12-34-56"
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">Account number</span>
          <input
            name="bank_account_number"
            defaultValue={company.bank_account_number ?? ''}
            placeholder="12345678"
            pattern="\d{8}"
            title="8 digits"
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">IBAN (optional)</span>
          <input
            name="bank_iban"
            defaultValue={company.bank_iban ?? ''}
            placeholder="GB00 XXXX 0000 0000 0000 00"
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">BIC (optional)</span>
          <input
            name="bank_bic"
            defaultValue={company.bank_bic ?? ''}
            placeholder="XXXXGB00"
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">Payment terms (printed text)</span>
          <input
            name="payment_terms"
            defaultValue={company.payment_terms ?? ''}
            placeholder="e.g. Payment due within 14 days"
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
          <span className="text-xs text-[color:var(--text-3)]">
            Free text shown in the payment section of the PDF.
          </span>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-[color:var(--text-2)]">Default payment terms (days)</span>
          <input
            name="default_payment_terms_days"
            type="number"
            min="0"
            max="365"
            step="1"
            defaultValue={company.default_payment_terms_days ?? 14}
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
          <span className="text-xs text-[color:var(--text-3)]">
            Used to set the due date when an account has no terms of its own.
          </span>
        </label>

        <label className="flex items-center gap-3 text-sm md:col-span-2">
          <input
            type="checkbox"
            name="vat_registered"
            defaultChecked={company.vat_registered}
            className="h-4 w-4 rounded border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
          />
          <span className="font-medium text-[color:var(--text-2)]">VAT registered</span>
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[color:var(--text-2)]">VAT number</span>
          <input
            name="vat_number"
            defaultValue={company.vat_number ?? ''}
            placeholder="e.g. GB123456789"
            className="os-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>
      </div>

      <p className="text-sm text-[color:var(--text-2)]">
        These details are printed in the payment section of every invoice PDF. Leave the account number blank to hide the payment block entirely.
      </p>

      <div className="flex items-center justify-between gap-4">
        <div>
          {state.error ? <p className="text-sm text-[color:var(--red-strong)]">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-[color:var(--emerald-strong)]">Payment details saved.</p> : null}
        </div>
        <SubmitButton />
      </div>
    </form>
  )
}
