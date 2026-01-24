import LoginForm from './LoginForm'

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string }
}) {
  const nextPath = searchParams?.next ?? '/workspaces'
  return <LoginForm nextPath={nextPath} />
}
