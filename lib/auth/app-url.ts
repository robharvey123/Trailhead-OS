/**
 * Base URL for links we email (invites, sign-in and reset links).
 * On a Vercel preview, links must open that preview (its branch alias, or the
 * deployment URL for branchless CLI deploys), not production, or a link sent
 * from a preview lands on code that isn't live.
 */
export function appUrl(): string {
  const previewHost = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL
  const base =
    process.env.VERCEL_ENV === 'preview' && previewHost
      ? `https://${previewHost}`
      : process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk'
  return base.replace(/\/$/, '')
}
