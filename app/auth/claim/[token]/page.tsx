import AuthShell from '@/components/os/AuthShell'
import { lookupClaimableInvite } from '../actions'
import ClaimForm from './ClaimForm'

export const dynamic = 'force-dynamic'

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await lookupClaimableInvite(token)

  if (!invite) {
    return (
      <AuthShell
        title="Invite unavailable"
        description="This invite link is invalid or has expired. Ask an admin to send a new one."
      />
    )
  }

  return (
    <AuthShell
      title="Claim your account"
      description={
        <>
          Setting up <strong>{invite.email}</strong>. Choose a password to finish.
        </>
      }
    >
      <div className="mt-6">
        <ClaimForm token={token} email={invite.email} />
      </div>
    </AuthShell>
  )
}
