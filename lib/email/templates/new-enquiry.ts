import type { Enquiry } from '@/lib/types'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatText(value: string | null | undefined): string {
  const text = value?.trim()
  return text ? escapeHtml(text) : '—'
}

function formatList(values: string[] | null | undefined): string {
  if (!values?.length) {
    return '—'
  }

  return values.map((value) => escapeHtml(value)).join(', ')
}

export function newEnquiryEmail(enquiry: Enquiry): { subject: string; html: string } {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
  const enquiryUrl = baseUrl ? `${baseUrl}/enquiries/${enquiry.id}` : `/enquiries/${enquiry.id}`
  const subject = `New enquiry — ${enquiry.biz_name}`

  return {
    subject,
    html: `
      <h1>${escapeHtml(subject)}</h1>
      <p><strong>Business name:</strong> ${formatText(enquiry.biz_name)}</p>
      <p><strong>Contact name:</strong> ${formatText(enquiry.contact_name)}</p>
      <p><strong>Contact email:</strong> ${formatText(enquiry.contact_email)}</p>
      <p><strong>Contact phone:</strong> ${formatText(enquiry.contact_phone)}</p>
      <p><strong>Business type:</strong> ${formatText(enquiry.biz_type)}</p>
      <p><strong>Project type:</strong> ${formatText(enquiry.project_type)}</p>
      <p><strong>Team size:</strong> ${formatText(enquiry.team_size)}</p>
      <p><strong>Top features:</strong> ${formatList(enquiry.top_features)}</p>
      <p><strong>Pain points:</strong><br />${formatText(enquiry.pain_points)}</p>
      <p><strong>Timeline:</strong> ${formatText(enquiry.timeline)}</p>
      <p><strong>How they found us:</strong> ${formatText(enquiry.referral_source)}</p>
      <p><strong>Budget:</strong> ${formatText(enquiry.budget)}</p>
      <p><a href="${escapeHtml(enquiryUrl)}">Open this enquiry in Trailhead OS</a></p>
    `.trim(),
  }
}
