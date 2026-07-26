import { confirmUnsubscribe } from './actions'

export const metadata = { title: 'Unsubscribe' }

export default async function UnsubscribeConfirmPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>
}) {
  const token = (searchParams ? await searchParams : undefined)?.token ?? ''

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Unsubscribe?</h1>
        <p className="mt-3 text-slate-600">
          Confirm below and you won’t receive any further emails from this campaign.
        </p>
        <form action={confirmUnsubscribe} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Confirm unsubscribe
          </button>
        </form>
      </div>
    </main>
  )
}
