import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import PlanIcon from '@/components/marketing/PlanIcon'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'

// Overrides the layout's index,follow so the 404 carries no conflicting robots tag.
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
}

export default async function MarketingNotFound() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return (
    <div className="pt-10 pb-16 md:pt-16 md:pb-20">
      <div className="bay">
        <div className="bay-code hidden lg:block">
          <p className="plan-data text-[var(--ink-3)]">404</p>
        </div>

        <div className="min-w-0">
          <h1 className="plan-display rack max-w-[14ch]">That page isn&rsquo;t on the shelf</h1>
          <p className="plan-lede mt-7">
            The link may be out of date, or the page has moved. Everything we do is
            one click from here.
          </p>

          <div className="ticket mt-10 max-w-md">
            <div className="ticket-rule flex flex-wrap gap-6">
              <Link href={buildMarketingHref('/consulting', isLocalhost)}>Consulting</Link>
              <Link href={buildMarketingHref('/studio', isLocalhost)}>Studio</Link>
              <Link href={buildMarketingHref('/labs', isLocalhost)}>Labs</Link>
              <Link href={buildMarketingHref('/blog', isLocalhost)}>Blog</Link>
            </div>
            <div className="ticket-rule">
              <Link href={buildMarketingHref('/', isLocalhost)} className="flash">
                Back to the homepage
                <PlanIcon name="right" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
