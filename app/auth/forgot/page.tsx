import ForgotForm from './ForgotForm'

export const metadata = { title: 'Reset password | Trailhead OS' }

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-300">Enter your email and we will send you a link to choose a new password.</p>
        <ForgotForm />
      </div>
    </div>
  )
}
