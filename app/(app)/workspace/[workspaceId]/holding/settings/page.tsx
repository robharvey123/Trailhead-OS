import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import HoldingSettingsClient from './SettingsClient'
import CompanyDetailsForm from '../../settings/CompanyDetailsForm'

export default async function SettingsPage({
  params,
}: {
  params: Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('workspace_settings')
    .select('company_name, company_address, company_city, company_postcode, company_country, company_email, company_phone, company_vat_number, company_number, bank_name, bank_account_name, bank_sort_code, bank_account_number, bank_iban, bank_swift')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const companyDetails = {
    company_name: settings?.company_name ?? null,
    company_address: settings?.company_address ?? null,
    company_city: settings?.company_city ?? null,
    company_postcode: settings?.company_postcode ?? null,
    company_country: settings?.company_country ?? null,
    company_email: settings?.company_email ?? null,
    company_phone: settings?.company_phone ?? null,
    company_vat_number: settings?.company_vat_number ?? null,
    company_number: settings?.company_number ?? null,
    bank_name: settings?.bank_name ?? null,
    bank_account_name: settings?.bank_account_name ?? null,
    bank_sort_code: settings?.bank_sort_code ?? null,
    bank_account_number: settings?.bank_account_number ?? null,
    bank_iban: settings?.bank_iban ?? null,
    bank_swift: settings?.bank_swift ?? null,
  }

  return (
    <div className="space-y-8">
      <HoldingSettingsClient workspaceId={workspaceId} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Company &amp; Bank Details</h2>
        <p className="mt-2 text-sm text-slate-300">
          Your company name, address, VAT/company numbers, and bank account details will appear on invoices and PDF exports.
        </p>
        <div className="mt-6">
          <CompanyDetailsForm workspaceId={workspaceId} company={companyDetails} />
        </div>
      </section>
    </div>
  )
}
