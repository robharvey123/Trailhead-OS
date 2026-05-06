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
  activeQuoteCount: number
  collapsed?: boolean
  onToggle?: () => void
}

function NavLink({
  href,
  label,
  active,
  onClick,
  dotColour,
  badge,
  collapsed,
}: {
  href: string
  label: string
  active: boolean
  onClick?: () => void
  dotColour?: string
  badge?: number
  collapsed?: boolean
}) {
  if (collapsed) {
    return (
      <Link
        href={href}
        onClick={onClick}
        title={label}
        className={`group relative flex h-9 w-9 items-center justify-center rounded-xl transition ${
          active
            ? 'bg-[#B8FF00]/10 text-[#B8FF00]'
            : 'text-[#9CA3AF] hover:bg-[#B8FF00]/5 hover:text-[#B8FF00]'
        }`}
      >
        {dotColour ? (
          <span className={`h-2.5 w-2.5 rounded-full ${dotColour}`} />
        ) : (
          <span className="text-xs font-semibold">{label.charAt(0)}</span>
        )}
        {typeof badge === 'number' && badge > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
        active
          ? 'bg-[#B8FF00]/10 text-[#B8FF00]'
          : 'text-[#9CA3AF] hover:bg-[#B8FF00]/5 hover:text-[#B8FF00]'
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
              ? 'bg-[#0C0C14]/20 text-[#0C0C14]'
              : 'bg-rose-500/15 text-rose-200'
          }`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9CA3AF] transition hover:bg-[#2A2A3A] hover:text-[#B8FF00]"
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  )
}

export default function Sidebar({
  workstreams,
  newEnquiryCount,
  activeQuoteCount,
  collapsed = false,
  onToggle,
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
    <aside
      className={`flex h-screen flex-col overflow-hidden border-r border-[#2A2A3A] bg-[#1A1A28] pointer-events-auto transition-[width] duration-300 ${
        collapsed ? 'w-16' : 'w-72'
      }`}
    >
      <div className={`flex flex-shrink-0 items-center ${collapsed ? 'justify-center p-2' : 'justify-between p-4'}`}>
        {collapsed ? (
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2A2A3A] bg-white"
            title="Dashboard"
          >
            <span className="text-sm font-bold text-[#0C0C14]">T</span>
          </Link>
        ) : (
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="block flex-1 rounded-3xl border border-[#2A2A3A] bg-white px-4 py-4 shadow-sm"
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
        )}
        {onToggle && !collapsed ? (
          <div className="ml-2 flex-shrink-0">
            <CollapseToggle collapsed={collapsed} onToggle={onToggle} />
          </div>
        ) : null}
      </div>

      {onToggle && collapsed ? (
        <div className="flex justify-center pb-1">
          <CollapseToggle collapsed={collapsed} onToggle={onToggle} />
        </div>
      ) : null}

      <nav className={`flex-1 overflow-y-auto py-2 ${collapsed ? 'px-1.5' : 'px-4'}`}>
        <div className={`pb-6 ${collapsed ? 'flex flex-col items-center space-y-2' : 'space-y-6'}`}>
          <div className={collapsed ? 'flex flex-col items-center space-y-1' : 'space-y-1.5'}>
            <NavLink
              href="/dashboard"
              label="Dashboard"
              active={pathname === '/dashboard'}
              onClick={() => setMobileOpen(false)}
              collapsed={collapsed}
            />
            <NavLink
              href="/calendar"
              label="Calendar"
              active={pathname === '/calendar'}
              onClick={() => setMobileOpen(false)}
              collapsed={collapsed}
            />
            <NavLink
              href="/tasks"
              label="Tasks"
              active={pathname === '/tasks'}
              onClick={() => setMobileOpen(false)}
              collapsed={collapsed}
            />
            <NavLink
              href="/projects"
              label="Projects"
              active={pathname === '/projects' || pathname.startsWith('/projects/records') || pathname === '/projects/new'}
              onClick={() => setMobileOpen(false)}
              collapsed={collapsed}
            />
          </div>

          <div className={collapsed ? 'flex flex-col items-center' : ''}>
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-[3px] text-[#B8FF00]">
                Workstreams
              </p>
            )}
            {collapsed && <div className="my-1 h-px w-6 bg-[#2A2A3A]" />}
            <div className={collapsed ? 'flex flex-col items-center space-y-1' : 'mt-2 space-y-1.5'}>
              {workstreams.map((workstream) => (
                <NavLink
                  key={workstream.id}
                  href={`/projects/${workstream.slug}`}
                  label={workstream.label}
                  active={pathname === `/projects/${workstream.slug}`}
                  onClick={() => setMobileOpen(false)}
                  dotColour={getWorkstreamColourClasses(workstream.colour).dot}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>

          <div className={collapsed ? 'flex flex-col items-center' : ''}>
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-[3px] text-[#B8FF00]">
                Clients
              </p>
            )}
            {collapsed && <div className="my-1 h-px w-6 bg-[#2A2A3A]" />}
            <div className={collapsed ? 'flex flex-col items-center space-y-1' : 'mt-2 space-y-1.5'}>
              <NavLink
                href="/enquiries"
                label="Enquiries"
                active={pathname.startsWith('/enquiries')}
                onClick={() => setMobileOpen(false)}
                badge={newEnquiryCount}
                collapsed={collapsed}
              />
              <NavLink
                href="/discovery?view=form"
                label="Discovery form"
                active={pathname.startsWith('/discovery')}
                onClick={() => setMobileOpen(false)}
                collapsed={collapsed}
              />
              <NavLink
                href="/crm/accounts"
                label="Accounts"
                active={pathname.startsWith('/crm/accounts')}
                onClick={() => setMobileOpen(false)}
                collapsed={collapsed}
              />
              <NavLink
                href="/crm/contacts"
                label="Contacts"
                active={pathname.startsWith('/crm/contacts')}
                onClick={() => setMobileOpen(false)}
                collapsed={collapsed}
              />
            </div>
          </div>

          <div className={collapsed ? 'flex flex-col items-center' : ''}>
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-[3px] text-[#B8FF00]">
                Commercial
              </p>
            )}
            {collapsed && <div className="my-1 h-px w-6 bg-[#2A2A3A]" />}
            <div className={collapsed ? 'flex flex-col items-center space-y-1' : 'mt-2 space-y-1.5'}>
              <NavLink
                href="/quotes"
                label="Quotes"
                active={pathname.startsWith('/quotes')}
                onClick={() => setMobileOpen(false)}
                badge={activeQuoteCount}
                collapsed={collapsed}
              />
              <NavLink
                href="/invoicing"
                label="Invoicing"
                active={pathname.startsWith('/invoicing')}
                onClick={() => setMobileOpen(false)}
                collapsed={collapsed}
              />
              <NavLink
                href="/expenses"
                label="Expenses"
                active={pathname.startsWith('/expenses')}
                onClick={() => setMobileOpen(false)}
                collapsed={collapsed}
              />
            </div>
          </div>

          <div className={collapsed ? 'flex flex-col items-center' : ''}>
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-[3px] text-[#B8FF00]">
                Content
              </p>
            )}
            {collapsed && <div className="my-1 h-px w-6 bg-[#2A2A3A]" />}
            <div className={collapsed ? 'flex flex-col items-center space-y-1' : 'mt-2 space-y-1.5'}>
              <NavLink
                href="/blog"
                label="Blog"
                active={
                  pathname === '/blog' ||
                  pathname.startsWith('/blog/') ||
                  pathname.startsWith('/os/blog')
                }
                onClick={() => setMobileOpen(false)}
                collapsed={collapsed}
              />
            </div>
          </div>

          <div className={collapsed ? 'flex flex-col items-center' : ''}>
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-[3px] text-[#B8FF00]">
                Analytics
              </p>
            )}
            {collapsed && <div className="my-1 h-px w-6 bg-[#2A2A3A]" />}
            <div className={collapsed ? 'flex flex-col items-center space-y-1' : 'mt-2 space-y-1.5'}>
              <NavLink
                href="/analytics"
                label="Analytics"
                active={
                  pathname.startsWith('/analytics') ||
                  pathname.startsWith('/workspaces') ||
                  pathname.startsWith('/workspace')
                }
                onClick={() => setMobileOpen(false)}
                collapsed={collapsed}
              />
              <NavLink
                href="/reports/weekly"
                label="Weekly Report"
                active={pathname.startsWith('/reports')}
                onClick={() => setMobileOpen(false)}
                collapsed={collapsed}
              />
            </div>
          </div>
        </div>
      </nav>

      <div className={`flex-shrink-0 space-y-2 border-t border-[#2A2A3A] ${collapsed ? 'p-2' : 'p-4'}`}>
        {collapsed ? (
          <>
            <NavLink
              href="/settings"
              label="Settings"
              active={pathname.startsWith('/settings')}
              onClick={() => setMobileOpen(false)}
              collapsed
            />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2A2A3A] text-xs font-semibold text-[#9CA3AF] transition hover:border-[#B8FF00]/30 hover:text-[#B8FF00] disabled:opacity-60 mx-auto"
            >
              {signingOut ? '...' : '✕'}
            </button>
          </>
        ) : (
          <>
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
              className="flex w-full items-center justify-center rounded-2xl border border-[#2A2A3A] px-4 py-3 text-sm font-medium text-[#9CA3AF] transition hover:border-[#B8FF00]/30 hover:text-[#B8FF00] disabled:opacity-60"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </>
        )}
      </div>
    </aside>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-2xl border border-[#2A2A3A] bg-[#0C0C14]/90 px-3 py-2 text-sm font-medium text-white backdrop-blur md:hidden"
      >
        Menu
      </button>

      <div
        className={`hidden transition-[width] duration-300 md:fixed md:inset-y-0 md:left-0 md:z-30 md:block md:overflow-hidden ${
          collapsed ? 'md:w-16' : 'md:w-72'
        }`}
      >
        {panel}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#0C0C14]/70"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div className="relative h-full max-w-[18rem]">{panel}</div>
        </div>
      ) : null}
    </>
  )
}
