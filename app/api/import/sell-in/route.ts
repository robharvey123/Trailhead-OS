import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  ImportPayloadSchema,
  validateSellInRows,
} from '@/lib/import/validation'
import { chunkArray, getDateRange } from '@/lib/import/utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = ImportPayloadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
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

  if (mode === 'replace' && !['owner', 'admin', 'editor'].includes(member.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to replace data.' },
      { status: 403 }
    )
  }

  const { validRows, rejected } = validateSellInRows(
    rows,
    workspaceId,
    rowOffset
  )

  if (!validRows.length) {
    return NextResponse.json({ inserted: 0, rejected })
  }

  if (mode === 'replace') {
    const brands = Array.from(new Set(validRows.map((row) => row.brand)))
    const range = getDateRange(validRows.map((row) => row.date))

    if (!brands.length || !range) {
      return NextResponse.json(
        { error: 'Unable to determine date range for replacement.' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('sell_in')
      .delete()
      .eq('workspace_id', workspaceId)
      .in('brand', brands)
      .gte('date', range.min)
      .lte('date', range.max)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }
  }

  let inserted = 0

  for (const chunk of chunkArray(validRows, 500)) {
    const { error } = await supabase.from('sell_in').insert(chunk)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    inserted += chunk.length
  }

  return NextResponse.json({ inserted, rejected })
}
