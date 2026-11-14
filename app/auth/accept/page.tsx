import { safeNextPath } from '@/lib/auth/safe-next'
import AuthShell from '@/components/os/AuthShell'
import Button from '@/components/ui/Button'

export const metadata = { title: 'Sign in' }

/**
 * Landing page for emailed sign-in and invite links. It renders a button that
 * POSTs to /auth/confirm; only that POST spends the one-time token, so a mail
 * scanner opening the link can't use it up. See app/auth/confirm/route.ts.
 */
export default async function AcceptPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const pick = (k: string) => {
    const v = params[k]
    return typeof v === 'string' ? v : ''
  }
  const tokenHash = pick('token_hash')
  const type = pick('type')
  const next = safeNextPath(pick('next'), '/')
  const valid = Boolean(tokenHash && type)
  const isInvite = type === 'invite'
  const isRecovery = type === 'recovery'

  return (
    <AuthShell
      title={isInvite ? 'Accept your invite' : isRecovery ? 'Reset your password' : 'Sign in'}
      description={
        valid
          ? isInvite
            ? 'Click the button to accept your invite and sign in to Trailhead OS.'
            : isRecovery
              ? 'Click the button to continue, then choose a new password.'
              : 'Click the button to finish signing in to Trailhead OS.'
          : 'This link is incomplete. Ask for a new one, or sign in with your password.'
      }
    >
      {valid ? (
        <form method="post" action="/auth/confirm" className="mt-6">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="primary" className="w-full">
            {isInvite ? 'Accept and sign in' : isRecovery ? 'Continue' : 'Sign in'}
          </Button>
        </form>
      ) : null}
    </AuthShell>
  )
}
