import { createClient } from '@/lib/supabase/server'
import SettingsForm from './SettingsForm'
import MappingForm from './MappingForm'
import MappingTable from './MappingTable'

export default async function SettingsPage({
  params,
}: {
  params: { workspaceId: string }
}) {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('workspace_settings')
    .select('brand_filter, cogs_pct, promo_cost, currency_symbol')
    .eq('workspace_id', params.workspaceId)
    .maybeSingle()

  const { data: mappings } = await supabase
    .from('customer_mappings')
    .select('id, sell_in_customer, sell_out_company, group_name')
    .eq('workspace_id', params.workspaceId)
    .order('sell_in_customer')

  const currentSettings = settings ?? {
    brand_filter: 'RUSH',
    cogs_pct: 0.55,
    promo_cost: 0.55,
    currency_symbol: '$',
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
        <h2 className="text-lg font-semibold">Model settings</h2>
        <p className="mt-2 text-sm text-slate-300">
          Configure brand filters and cost assumptions for this workspace.
        </p>
        <div className="mt-6">
          <SettingsForm workspaceId={params.workspaceId} settings={currentSettings} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">Customer mappings</h2>
        <p className="mt-2 text-sm text-slate-300">
          Map sell-in customers to sell-out companies and optional groups.
        </p>
        <div className="mt-6">
          <MappingForm workspaceId={params.workspaceId} />
        </div>
        <div className="mt-8">
          <MappingTable
            data={(mappings ?? []).map((row) => ({
              id: row.id,
              sell_in_customer: row.sell_in_customer,
              sell_out_company: row.sell_out_company,
              group_name: row.group_name,
            }))}
            workspaceId={params.workspaceId}
          />
        </div>
      </section>
    </div>
  )
}
