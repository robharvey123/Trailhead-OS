import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import MarketingShell from '@/components/marketing/MarketingShell'
import { isLocalDevelopmentHost } from '@/lib/site'
import { SITE_DEFAULTS } from '@/lib/seo'

const inter = Inter({
  subsets: ['latin'],
})

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

  return (
    <div className={inter.className}>
      <MarketingShell isLocalhost={isLocalhost}>{children}</MarketingShell>
    </div>
  )
}
