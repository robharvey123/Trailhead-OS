import { notFound } from 'next/navigation'
import QuoteDetailClient from '@/components/os/QuoteDetailClient'
import { getQuoteById } from '@/lib/db/quotes'
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
  const quote = await getQuoteById(id, supabase).catch(() => null)

  if (!quote) {
    notFound()
  }

  return <QuoteDetailClient quote={quote} warning={resolvedSearchParams?.warning ?? null} />
}
