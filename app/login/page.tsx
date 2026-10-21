import LoginForm from './LoginForm'
import { safeNextPath } from '@/lib/auth/safe-next'

const LINK_ERRORS: Record<string, string> = {
  link_invalid: 'That sign-in link is incomplete. Ask for a new one, or sign in with your password.',
  link_expired: 'That sign-in link has expired or was already used. Ask for a new one, or sign in with your password.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; error?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nextPath = safeNextPath(resolvedSearchParams?.next, '/dashboard')
  const initialMessage = resolvedSearchParams?.error ? LINK_ERRORS[resolvedSearchParams.error] ?? null : null
  return <LoginForm nextPath={nextPath} initialMessage={initialMessage} />
}
