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
import TrailheadLogo from '@/components/brand/TrailheadLogo'

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

/** Shared focus ring. --focus is blue bright on navy (blue ink is only 3.01:1 there). */
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]'

/**
 * Count badge on a nav row. Two kinds only: `unread` (mail and messages) is a
 * filled brand-blue badge with navy type; everything else is a neutral count.
 * `null` means the count query failed and is rendered as a warning, never as 0.
 */
function CountBadge({
  value,
  label,
  unread,
  compact,
}: {
  value: number | null | undefined
  label: string
  unread?: boolean
  compact?: boolean
}) {
  const shape = compact
    ? 'absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center px-1 text-[9px] font-bold'
    : 'px-2 py-0.5 text-[11px] font-semibold'

  if (value === null) {
    return (
      <span
        className={`rounded-pill bg-[var(--text-3)] text-[var(--navy)] ${shape}`}
        aria-label={`${label} count unavailable`}
        title="Couldn't load this count. The underlying query failed."
      >
        <span aria-hidden="true">!</span>
      </span>
    )
  }

  if (typeof value !== 'number' || value <= 0) return null

  const tone = unread
    ? 'bg-[var(--blue)] text-[var(--navy)]'
    : compact
      ? 'bg-[var(--text-3)] text-[var(--navy)]'
      : 'bg-[var(--surface-3)] text-[var(--text)]'

  return (
    <span className={`rounded-pill ${tone} ${shape}`} aria-label={unread ? `${value} unread` : `${value} ${label.toLowerCase()}`}>
      <span aria-hidden="true">{value}</span>
    </span>
  )
}

function NavLink({
  href,
  label,
  active,
  onClick,
  dotColour,
  icon,
  badge,
  unread,
  mentionBadge,
  collapsed,
}: {
  href: string
  label: string
  active: boolean
  onClick?: () => void
  dotColour?: string
  icon?: ReactNode
  /** `null` means the count query failed. Rendered as a warning, never as 0. */
  badge?: number | null
  /** True for unread mail and unread messages: the only filled badges. */
  unread?: boolean
  /** "@N" mentions count, additive to `badge`. A neutral count like the rest. */
  mentionBadge?: number | null
  collapsed?: boolean
}) {
  // Active row: blue-tinted ground, white type, blue-bright icon and a 3px
  // brand-blue bar on the left edge.
  const state = active
    ? 'bg-[var(--accent-dim)] text-[var(--text)] before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-pill before:bg-[var(--blue)]'
    : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
  const iconTone = active ? 'text-[var(--accent-strong)]' : 'text-[var(--text-3)] group-hover:text-[var(--text)]'
  const hasMentions = typeof mentionBadge === 'number' && mentionBadge > 0

  if (collapsed) {
    return (
      <Link
        href={href}
        onClick={onClick}
        title={label}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex h-9 w-9 items-center justify-center rounded-card transition ${state} ${FOCUS_RING}`}
      >
        {icon ? (
          <span className={`flex items-center justify-center ${iconTone}`}>{icon}</span>
        ) : dotColour ? (
          <span className={`h-2.5 w-2.5 rounded-pill ${dotColour}`} />
        ) : (
          <span className="text-xs font-semibold">{label.charAt(0)}</span>
        )}
        {hasMentions ? (
          <span
            className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-[var(--text-3)] px-1 text-[9px] font-bold text-[var(--navy)]"
            aria-label={`${mentionBadge} mention${mentionBadge === 1 ? '' : 's'}`}
          >
            <span aria-hidden="true">@{mentionBadge}</span>
          </span>
        ) : null}
        <CountBadge value={badge} label={label} unread={unread} compact />
      </Link>
    )
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex items-center justify-between gap-3 rounded-card px-3 py-2 text-sm transition ${
        active ? 'font-medium' : ''
      } ${state} ${FOCUS_RING}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className={`flex items-center justify-center ${iconTone}`}>{icon}</span>
        ) : dotColour ? (
          <span className={`h-2.5 w-2.5 rounded-pill ${dotColour}`} />
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      <span className="flex items-center gap-1.5">
        {hasMentions ? (
          <span
            className="rounded-pill bg-[var(--surface-3)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text)]"
            aria-label={`${mentionBadge} mention${mentionBadge === 1 ? '' : 's'}`}
          >
            <span aria-hidden="true">@{mentionBadge}</span>
          </span>
        ) : null}
        <CountBadge value={badge} label={label} unread={unread} />
      </span>
    </Link>
  )
}

function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-7 w-7 items-center justify-center rounded-control text-[var(--text-3)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] ${FOCUS_RING}`}
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
      { href: '/sales/dashboard', label: 'Sales seat', icon: <IconContacts className={ICON_CLASS} />, match: (p) => p.startsWith('/sales') },
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
      // transitioned: see the `.os-shell` block in globals.css.
      // `th-dark` remaps the working tokens for the navy ground, so nothing in
      // here names a light or dark colour directly.
      className="th-dark os-sidebar-panel pointer-events-auto flex h-screen flex-col overflow-hidden border-r border-[var(--border)] bg-[linear-gradient(180deg,var(--navy),var(--navy-deep))]"
    >
      <div className={`flex flex-shrink-0 items-center ${collapsed ? 'justify-center px-2 pb-2 pt-4' : 'justify-between px-5 pb-4 pt-5'}`}>
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          aria-label="Trailhead Holdings: dashboard"
          title={collapsed ? 'Dashboard' : undefined}
          className={`rounded-control ${FOCUS_RING}`}
        >
          <TrailheadLogo variant="reverse" markOnly={collapsed} size={collapsed ? 28 : 34} />
        </Link>
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

      <nav aria-label="Primary" className={`flex-1 overflow-y-auto py-2 ${collapsed ? 'px-1.5' : 'px-3'}`}>
        <div className={`pb-6 ${collapsed ? 'flex flex-col items-center space-y-2' : 'space-y-5'}`}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.header ?? gi} className={collapsed ? 'flex flex-col items-center' : ''}>
              {!collapsed && group.header ? (
                <p className="os-label px-3">{group.header}</p>
              ) : null}
              {collapsed && gi > 0 ? <div className="my-1 h-px w-6 bg-[var(--border-light)]" /> : null}
              <div
                className={
                  collapsed
                    ? 'flex flex-col items-center space-y-1'
                    : `${group.header ? 'mt-2 ' : ''}space-y-0.5`
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
                    unread={item.badgeKey === 'mail' || item.badgeKey === 'messages'}
                    mentionBadge={item.mention ? unreadMentionsCount : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className={`flex-shrink-0 space-y-1 border-t border-[var(--border)] ${collapsed ? 'p-2' : 'p-3'}`}>
        <NavLink
          href="/settings"
          label="Settings"
          icon={<IconSettings className={ICON_CLASS} />}
          active={pathname.startsWith('/settings')}
          onClick={() => setMobileOpen(false)}
          collapsed={collapsed}
        />
        {collapsed ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
            className={`mx-auto flex h-9 w-9 items-center justify-center rounded-card text-[var(--text-3)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-60 ${FOCUS_RING}`}
          >
            <IconSignOut className={ICON_CLASS} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className={`group flex w-full items-center gap-3 rounded-card px-3 py-2 text-sm text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-60 ${FOCUS_RING}`}
          >
            <span className="flex items-center justify-center text-[var(--text-3)] group-hover:text-[var(--text)]">
              <IconSignOut className={ICON_CLASS} />
            </span>
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        )}
      </div>
    </aside>
  )

  return (
    <>
      {/* The wrapper carries md:hidden: `.btn` sets its own display. */}
      <div className="fixed left-4 top-3 z-40 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls={mobileNavId}
          className="btn btn-ghost btn-sm"
        >
          Menu
        </button>
      </div>

      <div
        className="os-sidebar-rail hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:block md:overflow-hidden"
      >
        {panel}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--navy)]/45"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div id={mobileNavId} className="relative h-full max-w-[18rem]">{panel}</div>
        </div>
      ) : null}
    </>
  )
}
