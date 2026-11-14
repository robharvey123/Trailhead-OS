import AuthShell from '@/components/os/AuthShell'
import Button from '@/components/ui/Button'

export const metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <AuthShell
      title="That page doesn&rsquo;t exist"
      description="The link may be out of date, or the record it pointed at has been deleted."
    >
      <div className="mt-6 flex flex-wrap gap-3">
        <Button href="/dashboard" variant="primary">
          Go to dashboard
        </Button>
        <Button href="/" variant="secondary">
          Home
        </Button>
      </div>
    </AuthShell>
  )
}
