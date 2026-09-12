import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { CoworkApiError, jsonError } from '@/lib/cowork-api'
import { getCoworkExpense } from '@/lib/cowork-expenses'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { supabaseService } from '@/lib/supabase/service'

const MAX_BYTES = 10 * 1024 * 1024

// POST — attach a receipt. multipart/form-data with `file`, or JSON
// { filename, content_base64, content_type }. Lands in the private `receipts`
// bucket (service role bypasses the authenticated-role policies; no change).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    await getCoworkExpense(id) // 404 before any upload work

    let bytes: Uint8Array
    let filename: string
    let contentType: string | undefined

    if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File)) throw new CoworkApiError('No file provided', 400)
      if (file.size > MAX_BYTES) throw new CoworkApiError('Receipt exceeds the 10 MB limit', 413)
      bytes = new Uint8Array(await file.arrayBuffer())
      filename = file.name
      contentType = file.type || undefined
    } else {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
      if (typeof body.content_base64 !== 'string' || !body.content_base64) {
        throw new CoworkApiError('Send multipart/form-data with a file field, or JSON { filename, content_base64, content_type }', 400)
      }
      bytes = new Uint8Array(Buffer.from(body.content_base64, 'base64'))
      if (bytes.byteLength > MAX_BYTES) throw new CoworkApiError('Receipt exceeds the 10 MB limit', 413)
      filename = typeof body.filename === 'string' && body.filename ? body.filename : 'receipt'
      contentType = typeof body.content_type === 'string' ? body.content_type : undefined
    }

    const ext = filename.includes('.') ? filename.split('.').pop() : 'jpg'
    const path = `${id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabaseService.storage
      .from('receipts')
      .upload(path, bytes, { upsert: true, contentType })
    if (uploadError) throw new CoworkApiError(uploadError.message || 'Failed to upload receipt', 500)

    const { error: updateError } = await supabaseService.from('expenses').update({ receipt_url: path }).eq('id', id)
    if (updateError) throw new CoworkApiError(updateError.message || 'Failed to save receipt path', 500)

    const expense = await getCoworkExpense(id)
    void recordCoworkWrite({
      action: 'update',
      entity: 'expense',
      entityId: id,
      entityLabel: expense.description,
      engagementId: expense.engagement?.id ?? null,
      summary: `Attached receipt to expense "${expense.description}" (${expense.date})`,
      payload: { receipt_url: path },
    })
    return Response.json(expense)
  } catch (error) {
    return jsonError(error, 'Failed to attach receipt')
  }
}
