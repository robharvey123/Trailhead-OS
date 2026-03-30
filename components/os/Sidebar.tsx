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
        {dotColour ? (
          <span className={`h-2.5 w-2.5 rounded-full ${dotColour}`} />
        ) : null}
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

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const panel = (
    <aside className="flex h-screen w-72 flex-col overflow-hidden border-r border-slate-800 bg-slate-950 pointer-events-auto">
      <div className="flex-shrink-0 p-4">
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="block rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
        >
          <img
            src="/logo.svg"
            alt="Trailhead Holdings"
            className="h-8 w-auto dark:hidden"
          />
          <img
            src="/logo-dark.svg"
            alt="Trailhead Holdings"
            className="hidden h-8 w-auto dark:block"
          />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-2">
        <div className="space-y-6 pb-6">
          <div className="space-y-1.5">
            <NavLink
              href="/dashboard"
              label="Dashboard"
              active={pathname === '/dashboard'}
              onClick={() => setMobileOpen(false)}
            />
            <NavLink
              href="/calendar"
              label="Calendar"
              active={pathname === '/calendar'}
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
            <p className="px-3 text-xs uppercase tracking-[0.28em] text-slate-500">
              Workstreams
            </p>
            <div className="mt-2 space-y-1.5">
              {workstreams.map((workstream) => (
                <NavLink
                  key={workstream.id}
                  href={`/projects/${workstream.slug}`}
                  label={workstream.label}
                  active={pathname === `/projects/${workstream.slug}`}
                  onClick={() => setMobileOpen(false)}
                  dotColour={getWorkstreamColourClasses(workstream.colour).dot}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="px-3 text-xs uppercase tracking-[0.28em] text-slate-500">
              Clients
            </p>
            <div className="mt-2 space-y-1.5">
              <NavLink
                href="/enquiries"
                label="Enquiries"
                active={pathname.startsWith('/enquiries')}
                onClick={() => setMobileOpen(false)}
                badge={newEnquiryCount}
              />
              <NavLink
                href="/discovery"
                label="Discovery form"
                active={pathname.startsWith('/discovery')}
                onClick={() => setMobileOpen(false)}
              />
              <NavLink
                href="/crm/accounts"
                label="Accounts"
                active={pathname.startsWith('/crm/accounts')}
                onClick={() => setMobileOpen(false)}
              />
              <NavLink
                href="/crm/contacts"
                label="Contacts"
                active={pathname.startsWith('/crm/contacts')}
                onClick={() => setMobileOpen(false)}
              />
            </div>
          </div>

          <div>
            <p className="px-3 text-xs uppercase tracking-[0.28em] text-slate-500">
              Commercial
            </p>
            <div className="mt-2 space-y-1.5">
              <NavLink
                href="/quotes"
                label="Quotes"
                active={pathname.startsWith('/quotes')}
                onClick={() => setMobileOpen(false)}
              />
              <NavLink
                href="/invoicing"
                label="Invoicing"
                active={pathname.startsWith('/invoicing')}
                onClick={() => setMobileOpen(false)}
              />
            </div>
          </div>

          <div>
            <p className="px-3 text-xs uppercase tracking-[0.28em] text-slate-500">
              Content
            </p>
            <div className="mt-2 space-y-1.5">
              <NavLink
                href="/blog"
                label="Blog"
                active={
                  pathname === '/blog' ||
                  pathname.startsWith('/blog/') ||
                  pathname.startsWith('/os/blog')
                }
                onClick={() => setMobileOpen(false)}
              />
            </div>
          </div>

          <div>
            <p className="px-3 text-xs uppercase tracking-[0.28em] text-slate-500">
              Analytics
            </p>
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
        </div>
      </nav>

      <div className="flex-shrink-0 space-y-2 border-t border-slate-800 p-4">
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

      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:block md:w-72 md:overflow-hidden">
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
