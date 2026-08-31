import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Archivo, Martian_Mono } from 'next/font/google'
import MarketingShell from '@/components/marketing/MarketingShell'
import { isLocalDevelopmentHost } from '@/lib/site'
import { SITE_DEFAULTS } from '@/lib/seo'
import './bay.css'

// One family across its width axis does the whole signage job: condensed for
// the shelf-edge caps, normal for reading, the way a real retail signage
// system prints every rail height from one face. The mono is admitted for
// codes, prices, dates and dimensions only.
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
})

const martianMono = Martian_Mono({
  variable: '--font-martian',
  subsets: ['latin'],
  display: 'swap',
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
    <div className={`${archivo.variable} ${martianMono.variable}`}>
      <MarketingShell isLocalhost={isLocalhost}>{children}</MarketingShell>
    </div>
  )
}
