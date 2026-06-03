import { mockupFontVars } from '@/lib/fonts'
import { lookupClaimableInvite } from '../actions'
import ClaimForm from './ClaimForm'

export const dynamic = 'force-dynamic'

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await lookupClaimableInvite(token)

  return (
    <div className={`thmock ${mockupFontVars}`} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
        {!invite ? (
          <>
            <h1 className="topbar-title" style={{ marginBottom: 8 }}>Invite unavailable</h1>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>This invite link is invalid or has expired. Ask an admin to send a new one.</p>
          </>
        ) : (
          <>
            <h1 className="topbar-title" style={{ marginBottom: 4 }}>Claim your account</h1>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Setting up <strong>{invite.email}</strong>. Choose a password to finish.</p>
            <ClaimForm token={token} email={invite.email} />
          </>
        )}
      </div>
    </div>
  )
}
