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
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import ProfileSettingsForm from '@/components/os/ProfileSettingsForm'
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
  const profile = await getCurrentProfile(supabase)
  let linkedPersonName: string | null = null
  if (profile?.person_id) {
    try {
      const { data } = await supabase.from('people').select('full_name').eq('id', profile.person_id).maybeSingle()
      linkedPersonName = data?.full_name ?? null
    } catch {}
  }
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
    <div className="os-narrow space-y-6">
      <div>
        <p className="os-eyebrow">System</p>
        <h1 className="mt-2 os-page-title">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-2)]">
          A control panel for the core OS surfaces, live workspace settings, and the current signed-in account.
        </p>
      </div>

      {profile ? (
        <section className="os-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="os-eyebrow">Account</p>
              <h2 className="mt-2 os-section-title">Your profile</h2>
              <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-2)]">{user?.email ?? 'Unknown user'}</p>
            </div>
            {roleIsAdmin(profile.role) ? (
              <Link href="/admin/invites" className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--text)]">
                Manage invites
              </Link>
            ) : null}
          </div>
          <ProfileSettingsForm displayName={profile.display_name ?? ''} role={profile.role} personName={linkedPersonName} />
        </section>
      ) : null}

      <SettingsIntegrations
        initialGoogleEmail={googleEmail}
        paidInvoicesThisMonth={paidInvoicesThisMonth}
      />

      <section className="os-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="os-eyebrow">Company</p>
            <h2 className="mt-2 os-section-title">Email footer details</h2>
            <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-2)]">
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
        <section className="os-card p-6">
          <p className="os-eyebrow">Account</p>
          <h2 className="mt-2 os-section-title">Signed-in access</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">Email</p>
              <p className="mt-2 text-sm text-[color:var(--text)]">{user?.email ?? 'Unknown user'}</p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">Workspace count</p>
              <p className="mt-2 text-sm text-[color:var(--text)]">{workspaces.length}</p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">New enquiries</p>
              <p className="mt-2 text-sm text-[color:var(--text)]">{newEnquiryCount}</p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">Draft invoices</p>
              <p className="mt-2 text-sm text-[color:var(--text)]">{draftInvoiceCount}</p>
            </div>
          </div>
        </section>

        <section className="os-card p-6">
          <p className="os-eyebrow">Shortcuts</p>
          <h2 className="mt-2 os-section-title">Core OS areas</h2>
          <div className="mt-5 grid gap-3">
            <Link href="/analytics" className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-4 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--border-light)]">
              Analytics workspace list
            </Link>
            <Link href="/crm/contacts" className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-4 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--border-light)]">
              CRM contacts ({contactsCount})
            </Link>
            <Link href="/enquiries" className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-4 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--border-light)]">
              Enquiries inbox
            </Link>
            <Link href="/invoicing" className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-4 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--border-light)]">
              Invoicing
            </Link>
          </div>
        </section>
      </div>

      <section className="os-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="os-eyebrow">Analytics</p>
            <h2 className="mt-2 os-section-title">Workspace settings</h2>
            <p className="mt-2 text-sm text-[color:var(--text-2)]">
              Jump straight into any analytics workspace configuration surface.
            </p>
          </div>
          <Link
            href="/analytics"
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--text)]"
          >
            Open workspace list
          </Link>
        </div>

        {workspaces.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
            No analytics workspaces yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/analytics/${workspace.id}/settings`}
                className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-4 transition hover:border-[color:var(--border-light)]"
              >
                <p className="text-sm font-medium text-[color:var(--text)]">{workspace.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">
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
