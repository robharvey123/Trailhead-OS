import { createClient } from '@/lib/supabase/server'
import SettingsForm from './SettingsForm'
import CompanyDetailsForm from './CompanyDetailsForm'
import FxRatesTable from './FxRatesTable'
import MappingForm from './MappingForm'
import MappingTable from './MappingTable'
import InviteMemberForm from './InviteMemberForm'
import UserTable from './UserTable'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

export default async function SettingsPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const resolvedParams = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return <div className="p-8">You must be logged in to view this page.</div>
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', resolvedParams.workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['owner', 'admin'].includes(member.role)) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Access denied</h2>
        <p className="text-slate-400">Only workspace admins can view or edit settings.</p>
      </div>
    )
  }

  const { data: settings } = await supabase
    .from('workspace_settings')
    .select('brand_filter, cogs_pct, promo_cost, base_currency, supported_currencies, company_name, company_address, company_city, company_postcode, company_country, company_email, company_phone, company_vat_number')
    .eq('workspace_id', resolvedParams.workspaceId)
    .maybeSingle()

  const { data: fxRates } = await supabase
    .from('fx_rates')
    .select('id, from_currency, to_currency, rate, effective_date')
    .eq('workspace_id', resolvedParams.workspaceId)
    .order('from_currency')
    .order('effective_date', { ascending: false })

  const { data: mappings } = await supabase
    .from('customer_mappings')
    .select('id, sell_in_customer, sell_out_company, group_name')
    .eq('workspace_id', resolvedParams.workspaceId)
    .order('sell_in_customer')

  const currentSettings = settings ?? {
    brand_filter: 'RUSH',
    cogs_pct: 0.55,
    promo_cost: 0.55,
    base_currency: 'GBP',
    supported_currencies: ['GBP', 'EUR', 'USD', 'SEK', 'CHF', 'NOK', 'DKK'],
  }

  const companyDetails = {
    company_name: settings?.company_name ?? null,
    company_address: settings?.company_address ?? null,
    company_city: settings?.company_city ?? null,
    company_postcode: settings?.company_postcode ?? null,
    company_country: settings?.company_country ?? null,
    company_email: settings?.company_email ?? null,
    company_phone: settings?.company_phone ?? null,
    company_vat_number: settings?.company_vat_number ?? null,
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Settings
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Workspace settings</h1>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Invite member</h2>
        <p className="mt-2 text-sm text-slate-300">
          Add a user to this workspace by email and password. (Password will be visible to you and the user.)
        </p>
        <div className="mt-6">
          <InviteMemberForm workspaceId={resolvedParams.workspaceId} />
        </div>
        <UserTable workspaceId={resolvedParams.workspaceId} />
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Company details</h2>
        <p className="mt-2 text-sm text-slate-300">
          Your company name and address will appear on invoices and PDF exports.
        </p>
        <div className="mt-6">
          <CompanyDetailsForm
            workspaceId={resolvedParams.workspaceId}
            company={companyDetails}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Model settings</h2>
        <p className="mt-2 text-sm text-slate-300">
          Configure brand filters and cost assumptions for this workspace.
        </p>
        <div className="mt-6">
          <SettingsForm
            workspaceId={resolvedParams.workspaceId}
            settings={currentSettings}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">FX rates</h2>
        <p className="mt-2 text-sm text-slate-300">
          Manual exchange rates vs base currency ({currentSettings.base_currency}). Used for multi-currency reporting.
        </p>
        <div className="mt-6">
          <FxRatesTable
            workspaceId={resolvedParams.workspaceId}
            baseCurrency={currentSettings.base_currency}
            supportedCurrencies={currentSettings.supported_currencies}
            initialRates={fxRates ?? []}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Customer mappings</h2>
        <p className="mt-2 text-sm text-slate-300">
          Map sell-in customers to sell-out companies and optional groups.
        </p>
        <div className="mt-6">
          <MappingForm workspaceId={resolvedParams.workspaceId} />
        </div>
        <div className="mt-8">
          <MappingTable
            data={(mappings ?? []).map((row) => ({
              id: row.id,
              sell_in_customer: row.sell_in_customer,
              sell_out_company: row.sell_out_company,
              group_name: row.group_name,
            }))}
            workspaceId={resolvedParams.workspaceId}
          />
        </div>
      </section>
    </div>
  )
}
