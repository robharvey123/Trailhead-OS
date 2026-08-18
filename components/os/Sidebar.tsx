'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useId, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  IconDashboard, IconCalendar, IconTasks, IconMessages, IconInbox,
  IconEngagements, IconProjects, IconTimesheet, IconAccounts, IconContacts,
  IconMeetings, IconDeals, IconOutreach, IconEnquiries, IconQuotes,
  IconInvoicing, IconExpenses, IconAnalytics, IconGrowth, IconReport, IconBlog,
  IconDiscovery, IconSettings, IconSignOut,
} from '@/components/os/nav-icons'

const ICON_CLASS = 'h-[18px] w-[18px] shrink-0'

interface SidebarProps {
  newEnquiryCount: number | null
  activeQuoteCount: number | null
  unreadTaskCount?: number | null
  unreadMailCount?: number | null
  unreadMessageCount?: number | null
  unreadMentionsCount?: number | null
  collapsed?: boolean
  onToggle?: () => void
}

function NavLink({
  href,
  label,
  active,
  onClick,
  dotColour,
  icon,
  badge,
  mentionBadge,
  collapsed,
}: {
  href: string
  label: string
  active: boolean
  onClick?: () => void
  dotColour?: string
  icon?: ReactNode
  /** `null` means the count query failed — rendered as a warning, never as 0. */
  badge?: number | null
  /** Distinct, attention-grabbing "@N" mention chip, additive to `badge`. */
  mentionBadge?: number | null
  collapsed?: boolean
}) {
  if (collapsed) {
    return (
      <Link
        href={href}
        onClick={onClick}
        title={label}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex h-9 w-9 items-center justify-center rounded-xl transition ${
          active
            ? 'bg-[#E0F2FE] text-[#0369A1]'
            : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
        }`}
      >
        {icon ? (
          icon
        ) : dotColour ? (
          <span className={`h-2.5 w-2.5 rounded-full ${dotColour}`} />
        ) : (
          <span className="text-xs font-semibold">{label.charAt(0)}</span>
        )}
        {typeof mentionBadge === 'number' && mentionBadge > 0 ? (
          <span
            className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white"
            aria-label={`${mentionBadge} mention${mentionBadge === 1 ? '' : 's'}`}
          >
            <span aria-hidden="true">@{mentionBadge}</span>
          </span>
        ) : null}
        {badge === null ? (
          <span
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-3)] text-[9px] font-bold text-[color:var(--text-3)]"
            aria-label={`${label} count unavailable`}
          >
            <span aria-hidden="true">!</span>
          </span>
        ) : typeof badge === 'number' && badge > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white"
            aria-label={`${badge} unread`}
          >
            <span aria-hidden="true">{badge}</span>
          </span>
        ) : null}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
        active
          ? 'bg-[#E0F2FE] text-[#0369A1]'
          : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className={`flex items-center justify-center ${active ? '' : 'text-[#64748B]'}`}>{icon}</span>
        ) : dotColour ? (
          <span className={`h-2.5 w-2.5 rounded-full ${dotColour}`} />
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      <span className="flex items-center gap-1.5">
        {typeof mentionBadge === 'number' && mentionBadge > 0 ? (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700"
            aria-label={`${mentionBadge} mention${mentionBadge === 1 ? '' : 's'}`}
          >
            <span aria-hidden="true">@{mentionBadge}</span>
          </span>
        ) : null}
        {badge === null ? (
          <span
            className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--text-3)]"
            aria-label={`${label} count unavailable`}
            title="Couldn't load this count — the underlying query failed."
          >
            <span aria-hidden="true">!</span>
          </span>
        ) : typeof badge === 'number' && badge > 0 ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              active
                ? 'bg-[#0EA5E9] text-white'
                : 'bg-rose-100 text-rose-600'
            }`}
            aria-label={`${badge} unread`}
          >
            <span aria-hidden="true">{badge}</span>
          </span>
        ) : null}
      </span>
    </Link>
  )
}

function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-[#F1F5F9] hover:text-[#0EA5E9]"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
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

type BadgeKey = 'enquiries' | 'quotes' | 'tasks' | 'mail' | 'messages'
type NavItem = {
  href: string
  label: string
  icon: ReactNode
  match: (p: string) => boolean
  badgeKey?: BadgeKey
  mention?: boolean
}
type NavGroup = { header?: string; items: NavItem[] }

// Grouped by "what am I doing": daily workspace first, then delivery (the where-are-we
// cluster), clients/CRM, money, insights, content. Reorder here — the render is generic.
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <IconDashboard className={ICON_CLASS} />, match: (p) => p === '/dashboard' },
      { href: '/calendar', label: 'Calendar', icon: <IconCalendar className={ICON_CLASS} />, match: (p) => p === '/calendar' },
      { href: '/tasks', label: 'Tasks', icon: <IconTasks className={ICON_CLASS} />, match: (p) => p === '/tasks' || p.startsWith('/my-work/'), badgeKey: 'tasks' },
      { href: '/messages', label: 'Messages', icon: <IconMessages className={ICON_CLASS} />, match: (p) => p === '/messages' || p.startsWith('/messages/'), badgeKey: 'messages', mention: true },
      { href: '/inbox', label: 'Inbox', icon: <IconInbox className={ICON_CLASS} />, match: (p) => p.startsWith('/inbox'), badgeKey: 'mail' },
    ],
  },
  {
    header: 'Delivery',
    items: [
      { href: '/engagements', label: 'Engagements', icon: <IconEngagements className={ICON_CLASS} />, match: (p) => p.startsWith('/engagements') },
      { href: '/projects', label: 'Projects', icon: <IconProjects className={ICON_CLASS} />, match: (p) => p === '/projects' || p.startsWith('/projects/records') || p === '/projects/new' },
      { href: '/timesheet', label: 'Timesheet', icon: <IconTimesheet className={ICON_CLASS} />, match: (p) => p.startsWith('/timesheet') },
    ],
  },
  {
    header: 'Clients',
    items: [
      { href: '/crm/accounts', label: 'Accounts', icon: <IconAccounts className={ICON_CLASS} />, match: (p) => p.startsWith('/crm/accounts') },
      { href: '/crm/contacts', label: 'Contacts', icon: <IconContacts className={ICON_CLASS} />, match: (p) => p.startsWith('/crm/contacts') },
      { href: '/crm/meetings', label: 'Meetings', icon: <IconMeetings className={ICON_CLASS} />, match: (p) => p.startsWith('/crm/meetings') },
      { href: '/deals', label: 'Deals', icon: <IconDeals className={ICON_CLASS} />, match: (p) => p.startsWith('/deals') },
      { href: '/outreach', label: 'Outreach', icon: <IconOutreach className={ICON_CLASS} />, match: (p) => p.startsWith('/outreach') },
      { href: '/enquiries', label: 'Enquiries', icon: <IconEnquiries className={ICON_CLASS} />, match: (p) => p.startsWith('/enquiries'), badgeKey: 'enquiries' },
    ],
  },
  {
    header: 'Commercial',
    items: [
      { href: '/quotes', label: 'Quotes', icon: <IconQuotes className={ICON_CLASS} />, match: (p) => p.startsWith('/quotes'), badgeKey: 'quotes' },
      { href: '/invoicing', label: 'Invoicing', icon: <IconInvoicing className={ICON_CLASS} />, match: (p) => p.startsWith('/invoicing') },
      { href: '/expenses', label: 'Expenses', icon: <IconExpenses className={ICON_CLASS} />, match: (p) => p.startsWith('/expenses') },
    ],
  },
  {
    header: 'Insights',
    items: [
      { href: '/analytics', label: 'Analytics', icon: <IconAnalytics className={ICON_CLASS} />, match: (p) => p.startsWith('/analytics') || p.startsWith('/workspaces') || p.startsWith('/workspace') },
      { href: '/growth', label: 'Growth', icon: <IconGrowth className={ICON_CLASS} />, match: (p) => p.startsWith('/growth') },
      { href: '/reports/weekly', label: 'Weekly Report', icon: <IconReport className={ICON_CLASS} />, match: (p) => p.startsWith('/reports') },
    ],
  },
  {
    header: 'Content',
    items: [
      { href: '/blog', label: 'Blog', icon: <IconBlog className={ICON_CLASS} />, match: (p) => p === '/blog' || p.startsWith('/blog/') || p.startsWith('/os/blog') },
      { href: '/discovery?view=form', label: 'Discovery form', icon: <IconDiscovery className={ICON_CLASS} />, match: (p) => p.startsWith('/discovery') },
    ],
  },
]

export default function Sidebar({
  newEnquiryCount,
  activeQuoteCount,
  unreadTaskCount = 0,
  unreadMailCount = 0,
  unreadMessageCount = 0,
  unreadMentionsCount = 0,
  collapsed = false,
  onToggle,
}: SidebarProps) {
  const badgeValues: Record<BadgeKey, number | null | undefined> = {
    enquiries: newEnquiryCount,
    quotes: activeQuoteCount,
    tasks: unreadTaskCount,
    mail: unreadMailCount,
    messages: unreadMessageCount,
  }
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileNavId = useId()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const panel = (
    <aside
      // Width comes from --os-sidebar-w on the shell root, and is not
      // transitioned — see the `.os-shell` block in globals.css.
      className="os-sidebar-panel flex h-screen flex-col overflow-hidden border-r border-[#E2E8F0] bg-[#F8FAFC] pointer-events-auto"
    >
      <div className={`flex flex-shrink-0 items-center ${collapsed ? 'justify-center p-2' : 'justify-between p-4'}`}>
        {collapsed ? (
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white"
            title="Dashboard"
          >
            <span className="text-sm font-bold text-[#0C0C14]">T</span>
          </Link>
        ) : (
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="block flex-1 rounded-3xl border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm"
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

      <nav aria-label="Primary" className={`flex-1 overflow-y-auto py-2 ${collapsed ? 'px-1.5' : 'px-4'}`}>
        <div className={`pb-6 ${collapsed ? 'flex flex-col items-center space-y-2' : 'space-y-6'}`}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.header ?? gi} className={collapsed ? 'flex flex-col items-center' : ''}>
              {!collapsed && group.header ? (
                <p className="px-3 text-[10px] font-bold uppercase tracking-[3px] text-[color:var(--text-3)]">{group.header}</p>
              ) : null}
              {collapsed && gi > 0 ? <div className="my-1 h-px w-6 bg-[#E2E8F0]" /> : null}
              <div
                className={
                  collapsed
                    ? 'flex flex-col items-center space-y-1'
                    : `${group.header ? 'mt-2 ' : ''}space-y-1.5`
                }
              >
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={item.match(pathname)}
                    onClick={() => setMobileOpen(false)}
                    collapsed={collapsed}
                    badge={item.badgeKey ? badgeValues[item.badgeKey] : undefined}
                    mentionBadge={item.mention ? unreadMentionsCount : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className={`flex-shrink-0 space-y-2 border-t border-[#E2E8F0] ${collapsed ? 'p-2' : 'p-4'}`}>
        {collapsed ? (
          <>
            <NavLink
              href="/settings"
              label="Settings"
              icon={<IconSettings className={ICON_CLASS} />}
              active={pathname.startsWith('/settings')}
              onClick={() => setMobileOpen(false)}
              collapsed
            />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Sign out"
              title="Sign out"
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#475569] transition hover:border-[#0EA5E9]/40 hover:text-[#0EA5E9] disabled:opacity-60"
            >
              <IconSignOut className={ICON_CLASS} />
            </button>
          </>
        ) : (
          <>
            <NavLink
              href="/settings"
              label="Settings"
              icon={<IconSettings className={ICON_CLASS} />}
              active={pathname.startsWith('/settings')}
              onClick={() => setMobileOpen(false)}
            />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#E2E8F0] px-4 py-3 text-sm font-medium text-[#475569] transition hover:border-[#0EA5E9]/40 hover:text-[#0EA5E9] disabled:opacity-60"
            >
              <IconSignOut className={ICON_CLASS} />
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
        aria-expanded={mobileOpen}
        aria-controls={mobileNavId}
        className="fixed left-4 top-4 z-40 rounded-2xl border border-[#E2E8F0] bg-white/90 px-3 py-2 text-sm font-medium text-[#0F172A] backdrop-blur md:hidden"
      >
        Menu
      </button>

      <div
        className="os-sidebar-rail hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:block md:overflow-hidden"
      >
        {panel}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(15,23,42,0.45)]"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div id={mobileNavId} className="relative h-full max-w-[18rem]">{panel}</div>
        </div>
      ) : null}
    </>
  )
}
