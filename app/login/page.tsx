import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nextPath = resolvedSearchParams?.next ?? '/dashboard'
  return <LoginForm nextPath={nextPath} />
}
