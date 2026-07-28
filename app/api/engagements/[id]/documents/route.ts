import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const { data, error } = await supabase
      .from('engagement_documents')
      .select('*')
      .eq('engagement_id', id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json({ documents: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load documents' }, { status: 500 })
  }
}

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

// POST — two shapes, chosen by content type:
//   multipart/form-data with a "file" field → upload a document
//   JSON { type?, title, body_markdown, week_start? } → create a markdown doc
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params

    if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const { data: engagement } = await supabase.from('engagements').select('id').eq('id', id).maybeSingle()
      if (!engagement) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })

      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      if (file.size === 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 })
      if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds the 25 MB limit' }, { status: 400 })

      // Engagement-scoped path; timestamp keeps names unique within it.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file'
      const path = `${id}/${Date.now()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('engagement-docs')
        .upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (uploadError) return NextResponse.json({ error: uploadError.message || 'Upload failed' }, { status: 500 })

      const { data: doc, error: insErr } = await supabase
        .from('engagement_documents')
        .insert({
          engagement_id: id,
          type: 'upload',
          title: file.name,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        })
        .select('*')
        .single()
      if (insErr) {
        // Roll back the orphaned object so a failed insert leaves nothing behind.
        await supabase.storage.from('engagement-docs').remove([path]).then(() => {}, () => {})
        return NextResponse.json({ error: insErr.message || 'Failed to save document' }, { status: 500 })
      }
      return NextResponse.json({ document: doc }, { status: 201 })
    }

    const body = await request.json()
    const { data, error } = await supabase
      .from('engagement_documents')
      .insert({
        engagement_id: id,
        type: body.type ?? 'weekly_update',
        title: body.title ?? null,
        body_markdown: body.body_markdown ?? null,
        week_start: body.week_start ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ document: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save document' }, { status: 500 })
  }
}
