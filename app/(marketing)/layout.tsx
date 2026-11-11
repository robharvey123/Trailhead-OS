import type { Metadata } from 'next'
import { headers } from 'next/headers'
import MarketingShell from '@/components/marketing/MarketingShell'
import GoogleAnalytics from '@/components/marketing/GoogleAnalytics'
import { isLocalDevelopmentHost } from '@/lib/site'
import { SITE_DEFAULTS } from '@/lib/seo'
import './bay.css'

// Type follows the brand guidelines: Georgia for display (a system face, so
// nothing to load) and Inter for everything else, which the root layout
// already provides as --font-inter.

export const metadata: Metadata = {
  title: {
    default: `${SITE_DEFAULTS.name} | ${SITE_DEFAULTS.tagline}`,
    template: `%s | ${SITE_DEFAULTS.name}`,
  },
  description: SITE_DEFAULTS.description,
}

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

  return (
    <div>
      {gaId && !isLocalhost ? <GoogleAnalytics measurementId={gaId} /> : null}
      <MarketingShell isLocalhost={isLocalhost}>{children}</MarketingShell>
    </div>
  )
}
