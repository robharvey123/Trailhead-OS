import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * GET — convert an uploaded .docx to HTML for inline preview. The document is read
 * and converted entirely on our server (via the user's RLS-scoped session); nothing
 * is sent to a third-party viewer, which matters for confidential client documents.
 * Only .docx converts — legacy .doc and other types fall back to download client-side.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id, docId } = await params

    const { data: doc } = await supabase
      .from('engagement_documents')
      .select('file_path, mime_type, file_name')
      .eq('id', docId)
      .eq('engagement_id', id)
      .maybeSingle()
    if (!doc?.file_path) return NextResponse.json({ error: 'No file for this document' }, { status: 404 })

    const isDocx = doc.mime_type === DOCX_MIME || (doc.file_name ?? '').toLowerCase().endsWith('.docx')
    if (!isDocx) return NextResponse.json({ error: 'Not a .docx document' }, { status: 400 })

    const { data: blob, error: dlErr } = await supabase.storage.from('engagement-docs').download(doc.file_path)
    if (dlErr || !blob) return NextResponse.json({ error: dlErr?.message || 'Failed to read file' }, { status: 500 })

    const buffer = Buffer.from(await blob.arrayBuffer())
    const { value } = await mammoth.convertToHtml({ buffer })

    // Uploads are Rob's own (single-tenant), but strip the two vectors a crafted docx
    // could carry through mammoth's otherwise controlled output: javascript: hrefs and
    // inline event handlers.
    const html = value
      .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href\s*=\s*["'])\s*javascript:[^"']*(["'])/gi, '$1#$2')

    return NextResponse.json({ html })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to render document' }, { status: 500 })
  }
}
