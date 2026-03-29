import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import MarketingShell from '@/components/marketing/MarketingShell'
import { isLocalDevelopmentHost } from '@/lib/site'

const inter = Inter({
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Trailhead Holdings',
    template: '%s | Trailhead Holdings',
  },
  description:
    'Commercial strategy, digital product development, and SaaS ventures from Trailhead Holdings Ltd.',
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
