import type { CompanySettings } from '@/lib/company-settings'

// Outreach-only email footer. This DELIBERATELY omits the street address
// (address_line1 / address_line2) and the postcode: os_company_settings holds
// Trailhead's registered office, which is a home address, and a cold campaign to
// 100 strangers must not broadcast it. Invoices, quotes and enquiry replies still
// use renderCompanyEmailFooterHtml (lib/company-settings.ts), which keeps the full
// address because those go to known counterparties. Do NOT "fix" this by reusing
// that renderer here — the reduced address is the point. City, country and the
// registered company number are enough to satisfy the PECR/Companies Act footer
// duty without publishing the street.

// Hardcoded on purpose. buildMarketingSiteUrl (lib/site.ts) takes an isLocalhost
// flag that has no meaningful value in a server-side send, and returns the apex,
// which vercel.json then 301s to www — a redirect hop inside a cold email is worth
// avoiding, so we point straight at the www privacy page.
const PRIVACY_URL = 'https://www.trailheadholdings.uk/privacy'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Footer for cold-outreach emails: same visual block as renderCompanyEmailFooterHtml
 * (bordered div, 12px grey type) but with a reduced address, followed by the
 * unsubscribe + privacy line. `confirmUnsubUrl` must be the confirm-page URL, not
 * the one-click POST endpoint — link scanners issue GETs and the confirm page is
 * what stops them unsubscribing prospects on the recipient's behalf.
 */
export function renderOutreachFooterHtml(settings: CompanySettings, opts: { confirmUnsubUrl: string }) {
  const lines = [
    `<p style="margin:0"><strong>${escapeHtml(settings.company_name)}</strong></p>`,
  ]

  // City + country only — no street, no postcode.
  if (settings.city) {
    lines.push(`<p style="margin:4px 0 0">${escapeHtml(settings.city)}</p>`)
  }

  if (settings.country) {
    lines.push(`<p style="margin:4px 0 0">${escapeHtml(settings.country)}</p>`)
  }

  if (settings.company_number) {
    lines.push(
      `<p style="margin:4px 0 0">Registered in England &amp; Wales ${escapeHtml(settings.company_number)}</p>`
    )
  }

  if (settings.company_email) {
    lines.push(
      `<p style="margin:4px 0 0"><a href="mailto:${escapeHtml(settings.company_email)}" style="color:#0f172a;text-decoration:none">${escapeHtml(settings.company_email)}</a></p>`
    )
  }

  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;color:#475569;font-size:12px;line-height:1.6">
      ${lines.join('')}
    </div>
    <p style="margin:8px 0 0;color:#94a3b8;font-size:12px"><a href="${opts.confirmUnsubUrl}" style="color:#94a3b8;text-decoration:underline">Unsubscribe from these emails</a> · <a href="${PRIVACY_URL}" style="color:#94a3b8;text-decoration:underline">Privacy</a></p>
  `
}
