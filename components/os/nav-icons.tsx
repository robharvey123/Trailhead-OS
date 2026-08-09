import type { SVGProps } from 'react'

/**
 * Inline stroke-icon set for the OS sidebar. 24×24, currentColor, no dependency —
 * a fixed nav doesn't need an icon library. Each icon inherits size/colour from the
 * wrapping link (h-[18px] w-[18px], text-current). Keep them geometric and legible
 * at 18px.
 */
function Base({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export type IconProps = SVGProps<SVGSVGElement>

export const IconDashboard = (p: IconProps) => (
  <Base {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Base>
)
export const IconCalendar = (p: IconProps) => (
  <Base {...p}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></Base>
)
export const IconTasks = (p: IconProps) => (
  <Base {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M8 12.5l2.5 2.5L16 9" /></Base>
)
export const IconMessages = (p: IconProps) => (
  <Base {...p}><path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" /></Base>
)
export const IconInbox = (p: IconProps) => (
  <Base {...p}><path d="M4 13l2.6-7.2A2 2 0 0 1 8.5 4.5h7a2 2 0 0 1 1.9 1.3L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M4 13h4l1.5 2.5h5L16 13h4" /></Base>
)
export const IconEngagements = (p: IconProps) => (
  <Base {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18" /></Base>
)
export const IconProjects = (p: IconProps) => (
  <Base {...p}><rect x="3" y="3.5" width="5.5" height="17" rx="1.5" /><rect x="9.75" y="3.5" width="5.5" height="11" rx="1.5" /><rect x="16.5" y="3.5" width="5.5" height="14" rx="1.5" /></Base>
)
export const IconTimesheet = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></Base>
)
export const IconAccounts = (p: IconProps) => (
  <Base {...p}><path d="M4 20.5V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14.5" /><path d="M15 9h3a2 2 0 0 1 2 2v9.5M3 20.5h18M7.5 8h3M7.5 11.5h3M7.5 15h3" /></Base>
)
export const IconContacts = (p: IconProps) => (
  <Base {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.9M17.5 14.4A5.5 5.5 0 0 1 20.5 19.5" /></Base>
)
export const IconMeetings = (p: IconProps) => (
  <Base {...p}><rect x="3" y="6" width="12.5" height="12" rx="2" /><path d="M15.5 10l5-2.5v9L15.5 14" /></Base>
)
export const IconDeals = (p: IconProps) => (
  <Base {...p}><path d="M3.5 16.5l5-5 3.5 3.5 7.5-8" /><path d="M15.5 7h5v5" /></Base>
)
export const IconOutreach = (p: IconProps) => (
  <Base {...p}><path d="M3.5 10.5v3a1 1 0 0 0 1 1h2l7 4.5V5l-7 4.5h-2a1 1 0 0 0-1 1z" /><path d="M17 8.5a5 5 0 0 1 0 7" /></Base>
)
export const IconEnquiries = (p: IconProps) => (
  <Base {...p}><path d="M20 4.5H4a1 1 0 0 0-1 1V19l3.5-3H20a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1z" /><path d="M9.5 9.2a2.4 2.4 0 0 1 4.2 1.6c0 1.6-2.2 2-2.2 3.2M11.5 15.6h.01" /></Base>
)
export const IconQuotes = (p: IconProps) => (
  <Base {...p}><path d="M6 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19z" /><path d="M13.5 3.5v4.5H18M9 13h6M9 16.5h4" /></Base>
)
export const IconInvoicing = (p: IconProps) => (
  <Base {...p}><path d="M5 3.5h14v17l-2.3-1.5L14.4 20 12 18.5 9.6 20 7.3 19 5 20.5z" /><path d="M9 8.5h6M9 12h6" /></Base>
)
export const IconExpenses = (p: IconProps) => (
  <Base {...p}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M6.5 14.5h4" /></Base>
)
export const IconAnalytics = (p: IconProps) => (
  <Base {...p}><path d="M4 4v15.5a.5.5 0 0 0 .5.5H20" /><path d="M8 16.5V12M12 16.5V8M16 16.5v-3" /></Base>
)
export const IconReport = (p: IconProps) => (
  <Base {...p}><path d="M6 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19z" /><path d="M13.5 3.5v4.5H18M9.5 16.5V13M12 16.5v-5M14.5 16.5v-2.5" /></Base>
)
export const IconBlog = (p: IconProps) => (
  <Base {...p}><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></Base>
)
export const IconDiscovery = (p: IconProps) => (
  <Base {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 13.5h6M9 17h3.5" /></Base>
)
export const IconSettings = (p: IconProps) => (
  <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></Base>
)
export const IconSignOut = (p: IconProps) => (
  <Base {...p}><path d="M15 5.5V5a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 15 19v-.5" /><path d="M10 12h10m0 0l-3-3m3 3l-3 3" /></Base>
)
