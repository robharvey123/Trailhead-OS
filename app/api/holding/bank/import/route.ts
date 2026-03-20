import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { createHash } from 'crypto'

type TideRow = {
  date: string
  description: string
  paid_in: string
  paid_out: string
  balance: string
  reference: string
  category: string
}

function parseTideDate(raw: string): string | null {
  if (!raw) return null
  // Tide exports as DD/MM/YYYY or DD-MM-YYYY
  const parts = raw.split(/[\/\-]/)
  if (parts.length === 3) {
    const [d, m, y] = parts
    if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // Try ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

function parseAmount(val: string): number {
  if (!val) return 0
  return parseFloat(val.replace(/[^0-9.\-]/g, '')) || 0
}

function buildExternalId(date: string, amount: number, reference: string, counterparty: string): string {
  const raw = `${date}|${amount}|${reference}|${counterparty}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const rows: Record<string, string>[] = body.rows || []

  if (!rows.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 })

  let imported = 0
  let skipped = 0
  const errors: { row: number; reason: string }[] = []

  const inserts: {
    workspace_id: string
    external_id: string
    source: string
    date: string
    amount: number
    currency: string
    counterparty: string | null
    reference: string | null
    description: string | null
    category: string | null
    balance_after: number | null
  }[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    // Normalize keys
    const row: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      row[normalizeHeader(k)] = v
    }

    const date = parseTideDate(row.date || row.transaction_date || '')
    if (!date) {
      errors.push({ row: i + 1, reason: 'Invalid or missing date' })
      continue
    }

    const paidIn = parseAmount(row.paid_in || row.money_in || row.credit || '')
    const paidOut = parseAmount(row.paid_out || row.money_out || row.debit || '')
    const amount = paidIn > 0 ? paidIn : paidOut > 0 ? -paidOut : 0

    if (amount === 0) {
      errors.push({ row: i + 1, reason: 'No amount found' })
      continue
    }

    const description = row.description || row.transaction_description || ''
    const reference = row.reference || row.payment_reference || ''
    const category = row.category || row.transaction_category || null
    const balance = row.balance || row.balance_after || ''
    const counterparty = description.split(' - ')[0] || description || null

    const externalId = buildExternalId(date, amount, reference, counterparty || '')

    inserts.push({
      workspace_id: workspaceId,
      external_id: externalId,
      source: 'csv_import',
      date,
      amount,
      currency: 'GBP',
      counterparty,
      reference: reference || null,
      description: description || null,
      category,
      balance_after: balance ? parseAmount(balance) : null,
    })
  }

  // Batch insert, skip duplicates
  for (const insert of inserts) {
    const { error } = await supabase.from('bank_transactions').upsert(insert, {
      onConflict: 'workspace_id,external_id',
      ignoreDuplicates: true,
    })

    if (error) {
      skipped++
    } else {
      imported++
    }
  }

  // Recount: upsert with ignoreDuplicates doesn't error on dupes
  // So imported includes skipped dupes — get actual count
  const { count } = await supabase
    .from('bank_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  return NextResponse.json({ imported, skipped, errors, total_in_db: count })
}
