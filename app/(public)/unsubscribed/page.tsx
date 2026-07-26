export const metadata = {
  title: 'Unsubscribed',
}

export default function UnsubscribedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-slate-900">You’ve been unsubscribed</h1>
        <p className="mt-3 text-slate-600">
          You won’t receive any further emails from this campaign. If this was a mistake or you have
          any questions, just reply to the original email or contact{' '}
          <a href="mailto:rob@trailheadholdings.uk" className="text-sky-600 underline">rob@trailheadholdings.uk</a>.
        </p>
      </div>
    </main>
  )
}
