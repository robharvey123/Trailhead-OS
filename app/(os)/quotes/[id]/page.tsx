import { notFound } from 'next/navigation'
import QuoteDetailClient from '@/components/os/QuoteDetailClient'
import { getQuoteById, getQuoteVersions } from '@/lib/db/quotes'
import { createClient } from '@/lib/supabase/server'

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ warning?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const [quote, versions] = await Promise.all([
    getQuoteById(id, supabase).catch(() => null),
    getQuoteVersions(id, supabase).catch(() => []),
  ])

  if (!quote) {
    notFound()
  }

  return (
    <QuoteDetailClient
      quote={quote}
      versions={versions}
      warning={resolvedSearchParams?.warning ?? null}
    />
  )
}
