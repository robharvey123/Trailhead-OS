import AuthShell from '@/components/os/AuthShell'
import ForgotForm from './ForgotForm'

export const metadata = { title: 'Reset password | Trailhead OS' }

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we will send you a link to choose a new password."
    >
      <ForgotForm />
    </AuthShell>
  )
}
