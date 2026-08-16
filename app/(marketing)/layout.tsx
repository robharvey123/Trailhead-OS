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
      {/* Scroll-reveal ships content at opacity:0 and depends on an
          IntersectionObserver to bring it back. That means a JS failure, a
          blocked chunk, or a crawler that does not execute scripts sees a hero
          and ~10,000px of blank page. The content is in the HTML — it is only
          CSS-hidden — so a noscript override restores all of it. */}
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html:
              '.marketing-reveal{opacity:1 !important;transform:none !important;transition:none !important}',
          }}
        />
      </noscript>
      <MarketingShell isLocalhost={isLocalhost}>{children}</MarketingShell>
    </div>
  )
}
