import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  parseImportPayload,
  validateSellOutRows,
  type SellOutInsert,
} from '@/lib/import/validation'
import { chunkArray, getDateRange } from '@/lib/import/utils'

const normalizeKeyPart = (value: string | number | null | undefined) =>
  String(value ?? '')
    .trim()
    .toLowerCase()

const buildSellOutKey = (row: SellOutInsert) =>
  [
    row.workspace_id,
    normalizeKeyPart(row.brand),
    normalizeKeyPart(row.company),
    normalizeKeyPart(row.product),
    row.month,
    normalizeKeyPart(row.units),
    normalizeKeyPart(row.platform),
    normalizeKeyPart(row.region),
    normalizeKeyPart(row.currency),
  ].join('|')

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = parseImportPayload(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { workspaceId, mode, rows, rowOffset } = parsed.data

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Workspace access denied.' }, { status: 403 })
  }

  if (
    (mode === 'replace' || mode === 'update') &&
    !['owner', 'admin', 'editor'].includes(member.role)
  ) {
    return NextResponse.json(
      { error: 'You do not have permission to modify existing data.' },
      { status: 403 }
    )
  }

  const { data: settingsRow } = await supabase
    .from('workspace_settings')
    .select('base_currency')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const baseCurrency = settingsRow?.base_currency || 'GBP'

  const { validRows, rejected } = validateSellOutRows(
    rows,
    workspaceId,
    rowOffset,
    baseCurrency
  )

  if (!validRows.length) {
    return NextResponse.json({ inserted: 0, rejected })
  }

  const seen = new Set<string>()
  let uniqueRows = validRows.filter((entry) => {
    const key = buildSellOutKey(entry.data)
    if (seen.has(key)) {
      rejected.push({ row: entry.row, reason: 'Duplicate row in import file.' })
      return false
    }
    seen.add(key)
    return true
  })

  if (!uniqueRows.length) {
    return NextResponse.json({ inserted: 0, rejected })
  }

  if (mode === 'append') {
    const brands = Array.from(new Set(uniqueRows.map((row) => row.data.brand)))
    const range = getDateRange(uniqueRows.map((row) => row.data.month))

    if (brands.length && range) {
      const { data: existingRows, error } = await supabase
        .from('sell_out')
        .select('workspace_id, company, brand, product, month, units, platform, region, currency')
        .eq('workspace_id', workspaceId)
        .in('brand', brands)
        .gte('month', range.min)
        .lte('month', range.max)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      const existingKeys = new Set(
        (existingRows ?? []).map((row) => buildSellOutKey(row))
      )

      uniqueRows = uniqueRows.filter((entry) => {
        const key = buildSellOutKey(entry.data)
        if (existingKeys.has(key)) {
          rejected.push({ row: entry.row, reason: 'Duplicate row already exists.' })
          return false
        }
        return true
      })
    }
  }

  const insertRows = uniqueRows.map((row) => row.data)

  if (!insertRows.length) {
    return NextResponse.json({ inserted: 0, rejected })
  }

  if (mode === 'replace' || mode === 'update') {
    const brands = Array.from(new Set(insertRows.map((row) => row.brand)))
    const range = getDateRange(insertRows.map((row) => row.month))

    if (!brands.length || !range) {
      return NextResponse.json(
        { error: 'Unable to determine date range for replacement.' },
        { status: 400 }
      )
    }

    const deleteQuery = supabase
      .from('sell_out')
      .delete()
      .eq('workspace_id', workspaceId)
      .in('brand', brands)
      .gte('month', range.min)
      .lte('month', range.max)

    if (mode === 'update') {
      const companies = Array.from(
        new Set(insertRows.map((row) => row.company))
      )
      if (companies.length) {
        deleteQuery.in('company', companies)
      }
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }
  }

  let inserted = 0

  for (const chunk of chunkArray(insertRows, 500)) {
    const { error } = await supabase.from('sell_out').insert(chunk)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    inserted += chunk.length
  }

  return NextResponse.json({ inserted, rejected })
}
