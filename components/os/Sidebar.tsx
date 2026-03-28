'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getWorkstreamColourClasses } from '@/lib/os'
import type { Workstream } from '@/lib/types'

interface SidebarProps {
  workstreams: Workstream[]
  newEnquiryCount: number
}

const REQUIRED_WORKSTREAMS = [
  { slug: 'brand-sales', label: 'Brand sales', colour: 'teal' },
  { slug: 'ecommerce', label: 'eBay & Amazon', colour: 'amber' },
  { slug: 'app-dev', label: 'App development', colour: 'purple' },
  { slug: 'mvp-cricket', label: 'MVP Cricket', colour: 'green' },
  { slug: 'consulting', label: 'Consulting', colour: 'coral' },
] as const

function NavLink({
  href,
  label,
  active,
  onClick,
  dotColour,
  badge,
}: {
  href: string
  label: string
  active: boolean
  onClick?: () => void
  dotColour?: string
  badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
        active
          ? 'bg-slate-100 text-slate-950'
          : 'text-slate-300 hover:bg-slate-900 hover:text-white'
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        {dotColour ? <span className={`h-2.5 w-2.5 rounded-full ${dotColour}`} /> : null}
        <span>{label}</span>
      </span>
      {typeof badge === 'number' && badge > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            active
              ? 'bg-slate-950/10 text-slate-950'
              : 'bg-rose-500/15 text-rose-200'
          }`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

export default function Sidebar({
  workstreams,
  newEnquiryCount,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const workstreamsBySlug = new Map(
    workstreams.map((workstream) => [workstream.slug, workstream])
  )

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const panel = (
    <aside className="flex h-full w-72 flex-col border-r border-slate-800 bg-slate-950 px-4 py-5">
      <Link
        href="/dashboard"
        onClick={() => setMobileOpen(false)}
        className="rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-4"
      >
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Trailhead</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">OS</h1>
      </Link>

      <nav className="mt-8 space-y-6">
        <div className="space-y-1.5">
          <NavLink
            href="/dashboard"
            label="Dashboard"
            active={pathname === '/dashboard'}
            onClick={() => setMobileOpen(false)}
          />
          <NavLink
            href="/tasks"
            label="Tasks"
            active={pathname === '/tasks'}
            onClick={() => setMobileOpen(false)}
          />
        </div>

        <div>
          <p className="px-3 text-xs uppercase tracking-[0.28em] text-slate-500">Workstreams</p>
          <div className="mt-2 space-y-1.5">
            {REQUIRED_WORKSTREAMS.map((item) => {
              const workstream = workstreamsBySlug.get(item.slug)
              const label = workstream?.label ?? item.label
              const colour = workstream?.colour ?? item.colour

              return (
              <NavLink
                key={item.slug}
                href={`/projects/${item.slug}`}
                label={label}
                active={pathname === `/projects/${item.slug}`}
                onClick={() => setMobileOpen(false)}
                dotColour={getWorkstreamColourClasses(colour).dot}
              />
              )
            })}
          </div>
        </div>

        <div>
          <p className="px-3 text-xs uppercase tracking-[0.28em] text-slate-500">Clients</p>
          <div className="mt-2 space-y-1.5">
            <NavLink
              href="/enquiries"
              label="Enquiries"
              active={pathname.startsWith('/enquiries')}
              onClick={() => setMobileOpen(false)}
              badge={newEnquiryCount}
            />
            <NavLink
              href="/crm/contacts"
              label="Contacts"
              active={pathname.startsWith('/crm')}
              onClick={() => setMobileOpen(false)}
            />
          </div>
        </div>

        <div>
          <p className="px-3 text-xs uppercase tracking-[0.28em] text-slate-500">Finance</p>
          <div className="mt-2 space-y-1.5">
            <NavLink
              href="/invoicing"
              label="Invoicing"
              active={pathname.startsWith('/invoicing')}
              onClick={() => setMobileOpen(false)}
            />
          </div>
        </div>

        <div>
          <p className="px-3 text-xs uppercase tracking-[0.28em] text-slate-500">Analytics</p>
          <div className="mt-2 space-y-1.5">
            <NavLink
              href="/analytics"
              label="Analytics"
              active={
                pathname.startsWith('/analytics') ||
                pathname.startsWith('/workspaces') ||
                pathname.startsWith('/workspace')
              }
              onClick={() => setMobileOpen(false)}
            />
          </div>
        </div>
      </nav>

      <div className="mt-auto space-y-2 pt-6">
        <NavLink
          href="/settings"
          label="Settings"
          active={pathname.startsWith('/settings')}
          onClick={() => setMobileOpen(false)}
        />
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center justify-center rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white disabled:opacity-60"
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm font-medium text-slate-100 backdrop-blur md:hidden"
      >
        Menu
      </button>

      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:block">
        {panel}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div className="relative h-full max-w-[18rem]">{panel}</div>
        </div>
      ) : null}
    </>
  )
}
