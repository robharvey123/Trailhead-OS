'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function InvoiceAccountFilter({ accounts, value }: { accounts: Array<{ id: string; name: string }>; value: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(accountId: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (accountId) params.set('account', accountId)
    else params.delete('account')
    router.push(`/invoicing${params.size ? `?${params.toString()}` : ''}`)
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="os-select" aria-label="Filter by account">
      <option value="">All accounts</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  )
}
