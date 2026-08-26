import { NextRequest, NextResponse } from 'next/server'
import { unzipSync, strFromU8 } from 'fflate'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { isCoworkJsonExport, parseCoworkJsonExport, parseWhatsAppExport, type DateOrder, type ParseResult } from '@/lib/whatsapp/parse-export'
import { commitImport, deleteImportBatch, previewImport, type ImportPlan, type Numbering } from '@/lib/whatsapp/import'
import { isValidTimeZone } from '@/lib/whatsapp/time'

export const runtime = 'nodejs'

// Vercel's classic body cap was 4.5 MB; a text-only export is well under this
// even for years of history. Reject clearly rather than surface an opaque 413.
const MAX_BYTES = 4 * 1024 * 1024

function extractText(name: string, bytes: Uint8Array): string {
  if (/\.zip$/i.test(name)) {
    const files = unzipSync(bytes)
    const entry = Object.keys(files).find((k) => /(^|\/)_chat\.txt$/i.test(k)) ?? Object.keys(files).find((k) => /\.txt$/i.test(k))
    if (!entry) throw new Error('Zip contains no _chat.txt')
    return strFromU8(files[entry])
  }
  return new TextDecoder('utf-8').decode(bytes)
}

function parseUpload(name: string, text: string, dateOrder: DateOrder): ParseResult {
  if (/\.json$/i.test(name)) {
    const json = JSON.parse(text) as unknown
    if (!isCoworkJsonExport(json)) throw new Error('JSON is not a WhatsApp conversation export')
    return parseCoworkJsonExport(json)
  }
  return parseWhatsAppExport(text, dateOrder)
}

// POST multipart/form-data:
//   file, mode ('preview' | 'commit'), date_order, timezone, numbering, plan (JSON, commit only)
export async function POST(request: NextRequest) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size === 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds the 4 MB limit. Export without media, or split the chat.' }, { status: 400 })

    const mode = (form.get('mode') as string | null) ?? 'preview'
    const dateOrderRaw = (form.get('date_order') as string | null) ?? 'DMY'
    if (dateOrderRaw !== 'DMY' && dateOrderRaw !== 'MDY') return NextResponse.json({ error: 'date_order must be DMY or MDY' }, { status: 400 })
    const timezone = (form.get('timezone') as string | null) || 'Europe/London'
    if (!isValidTimeZone(timezone)) return NextResponse.json({ error: `Unknown timezone: ${timezone}` }, { status: 400 })
    const numberingRaw = (form.get('numbering') as string | null) ?? 'business'
    if (numberingRaw !== 'business' && numberingRaw !== 'personal') return NextResponse.json({ error: 'numbering must be business or personal' }, { status: 400 })
    const numbering: Numbering = numberingRaw

    const bytes = new Uint8Array(await file.arrayBuffer())
    let parsed: ParseResult
    try {
      parsed = parseUpload(file.name, extractText(file.name, bytes), dateOrderRaw)
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not parse export' }, { status: 400 })
    }
    if (parsed.messages.length === 0 && parsed.participantEvents.length === 0) {
      return NextResponse.json({ error: 'No messages recognised. Is this a WhatsApp chat export?' }, { status: 400 })
    }

    if (mode === 'preview') {
      return NextResponse.json(await previewImport(parsed, supabase, timezone))
    }
    if (mode !== 'commit') return NextResponse.json({ error: 'mode must be preview or commit' }, { status: 400 })

    const planRaw = form.get('plan')
    if (typeof planRaw !== 'string') return NextResponse.json({ error: 'plan is required to commit' }, { status: 400 })
    let plan: ImportPlan
    try {
      plan = JSON.parse(planRaw) as ImportPlan
    } catch {
      return NextResponse.json({ error: 'plan is not valid JSON' }, { status: 400 })
    }
    if (!plan || !Array.isArray(plan.participants)) return NextResponse.json({ error: 'plan.participants is required' }, { status: 400 })
    if (!plan.conversation_id && !plan.title) return NextResponse.json({ error: 'plan.title is required for a new conversation' }, { status: 400 })

    const result = await commitImport({ parsed, plan: { ...plan, is_group: plan.is_group ?? parsed.isGroup }, timezone, numbering }, supabase)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 500 })
  }
}

// DELETE ?batch_id= — undo one import in a single statement.
export async function DELETE(request: NextRequest) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const batchId = request.nextUrl.searchParams.get('batch_id')
    if (!batchId) return NextResponse.json({ error: 'batch_id is required' }, { status: 400 })
    const deleted = await deleteImportBatch(batchId, supabase)
    return NextResponse.json({ deleted })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Undo failed' }, { status: 500 })
  }
}
