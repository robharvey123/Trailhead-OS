import { safeNextPath } from '@/lib/auth/safe-next'

export const metadata = { title: 'Sign in | Trailhead OS' }

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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">{isInvite ? 'Accept your invite' : isRecovery ? 'Reset your password' : 'Sign in'}</h1>
        {valid ? (
          <>
            <p className="mt-2 text-sm text-slate-300">
              {isInvite
                ? 'Click the button to accept your invite and sign in to Trailhead OS.'
                : isRecovery
                  ? 'Click the button to continue, then choose a new password.'
                  : 'Click the button to finish signing in to Trailhead OS.'}
            </p>
            <form method="post" action="/auth/confirm" className="mt-6">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                className="w-full rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white"
              >
                {isInvite ? 'Accept and sign in' : isRecovery ? 'Continue' : 'Sign in'}
              </button>
            </form>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-300">
            This link is incomplete. Ask for a new one, or sign in with your password.
          </p>
        )}
      </div>
    </div>
  )
}
