import Link from 'next/link'
import SettingsIntegrations from '@/components/os/SettingsIntegrations'
import CalendarSubscriptionSection from '@/components/os/CalendarSubscriptionSection'
import CompanySettingsForm from '@/components/os/CompanySettingsForm'
import PricingTierSettings from '@/components/os/PricingTierSettings'
import WorkstreamSettings from '@/components/os/WorkstreamSettings'
import { getCompanySettings } from '@/lib/company-settings'
import { getWorkstreams } from '@/lib/db/workstreams'
import { getPricingTiers } from '@/lib/db/pricing-tiers'
import { createClient } from '@/lib/supabase/server'
import type { PricingTier, Workstream } from '@/lib/types'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let contactsCount = 0
  let newEnquiryCount = 0
  let draftInvoiceCount = 0
  let paidInvoicesThisMonth = 0
  let workspaces: Array<{ id: string; name: string }> = []
  let workstreams: Workstream[] = []
  let pricingTiers: PricingTier[] = []
  let googleEmail: string | null = null
  const companySettings = await getCompanySettings(supabase)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(/\/$/, '')
  const icalSecret = process.env.ICAL_SECRET ?? ''

  try {
    const { count } = await supabase.from('contacts').select('id', { count: 'exact', head: true })
    contactsCount = count ?? 0
  } catch {}

  try {
    const { count } = await supabase
      .from('enquiries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new')
    newEnquiryCount = count ?? 0
  } catch {}

  try {
    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft')
    draftInvoiceCount = count ?? 0
  } catch {}

  try {
    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .gte('paid_at', startOfMonth.toISOString())
    paidInvoicesThisMonth = count ?? 0
  } catch {}

  try {
    const { data } = await supabase
      .from('workspaces')
      .select('id, name')
      .order('created_at', { ascending: false })
    workspaces = data ?? []
  } catch {}

  try {
    pricingTiers = await getPricingTiers(supabase)
  } catch {}

  try {
    workstreams = await getWorkstreams(supabase)
  } catch {}

  try {
    const { data } = await supabase
      .from('google_tokens')
      .select('email')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    googleEmail = data?.email ?? null
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-white0">System</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#9CA3AF]">
          A control panel for the core OS surfaces, live workspace settings, and the current signed-in account.
        </p>
      </div>

      <SettingsIntegrations
        initialGoogleEmail={googleEmail}
        paidInvoicesThisMonth={paidInvoicesThisMonth}
      />

      <section className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white0">Company</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Email footer details</h2>
            <p className="mt-2 max-w-2xl text-sm text-[#9CA3AF]">
              Set the legal company details appended to outbound invoice, quote, and enquiry emails.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <CompanySettingsForm company={companySettings} />
        </div>
      </section>

      <CalendarSubscriptionSection
        appUrl={appUrl}
        icalSecret={icalSecret}
        workstreams={workstreams}
      />

      <WorkstreamSettings initialWorkstreams={workstreams} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white0">Account</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Signed-in access</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white0">Email</p>
              <p className="mt-2 text-sm text-white">{user?.email ?? 'Unknown user'}</p>
            </div>
            <div className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white0">Workspace count</p>
              <p className="mt-2 text-sm text-white">{workspaces.length}</p>
            </div>
            <div className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white0">New enquiries</p>
              <p className="mt-2 text-sm text-white">{newEnquiryCount}</p>
            </div>
            <div className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white0">Draft invoices</p>
              <p className="mt-2 text-sm text-white">{draftInvoiceCount}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-white0">Shortcuts</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Core OS areas</h2>
          <div className="mt-5 grid gap-3">
            <Link href="/analytics" className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] px-4 py-4 text-sm text-[#9CA3AF] transition hover:border-[#2A2A3A]">
              Analytics workspace list
            </Link>
            <Link href="/crm/contacts" className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] px-4 py-4 text-sm text-[#9CA3AF] transition hover:border-[#2A2A3A]">
              CRM contacts ({contactsCount})
            </Link>
            <Link href="/enquiries" className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] px-4 py-4 text-sm text-[#9CA3AF] transition hover:border-[#2A2A3A]">
              Enquiries inbox
            </Link>
            <Link href="/invoicing" className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] px-4 py-4 text-sm text-[#9CA3AF] transition hover:border-[#2A2A3A]">
              Invoicing
            </Link>
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white0">Analytics</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Workspace settings</h2>
            <p className="mt-2 text-sm text-[#9CA3AF]">
              Jump straight into any analytics workspace configuration surface.
            </p>
          </div>
          <Link
            href="/analytics"
            className="rounded-2xl border border-[#2A2A3A] px-4 py-2 text-sm text-[#9CA3AF] transition hover:border-[#B8FF00]/40 hover:text-white"
          >
            Open workspace list
          </Link>
        </div>

        {workspaces.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-[#2A2A3A] px-4 py-10 text-center text-sm text-white0">
            No analytics workspaces yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/analytics/${workspace.id}/settings`}
                className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] px-4 py-4 transition hover:border-[#2A2A3A]"
              >
                <p className="text-sm font-medium text-white">{workspace.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white0">
                  Workspace settings
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <PricingTierSettings pricingTiers={pricingTiers} />
    </div>
  )
}
