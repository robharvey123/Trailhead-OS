import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { buildMarketingHref, isLocalDevelopmentHost } from '@/lib/site'

export { metadata } from '../../privacy/page'

export default async function LegacyPrivacyPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  redirect(buildMarketingHref('/privacy', isLocalhost))
}
