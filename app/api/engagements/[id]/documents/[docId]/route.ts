import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET — redirect to a short-lived signed URL for an uploaded document. Default is a
// download (attachment disposition); `?preview=1` mints an INLINE URL instead, so the
// drawer's <img>/<iframe> renders it in place rather than triggering a download.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id, docId } = await params
    const preview = request.nextUrl.searchParams.get('preview') === '1'

    const { data: doc } = await supabase
      .from('engagement_documents')
      .select('file_path, file_name')
      .eq('id', docId)
      .eq('engagement_id', id)
      .maybeSingle()
    if (!doc?.file_path) return NextResponse.json({ error: 'No file for this document' }, { status: 404 })

    // For preview, omit the `download` option so the object serves inline; RLS on the
    // bucket still scopes the signed URL to what this session may read.
    const { data: signed, error } = await supabase.storage
      .from('engagement-docs')
      .createSignedUrl(doc.file_path, preview ? 60 * 10 : 60 * 60, preview ? undefined : { download: doc.file_name ?? true })
    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: error?.message || 'Failed to sign URL' }, { status: 500 })
    }
    return NextResponse.redirect(signed.signedUrl)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load document' }, { status: 500 })
  }
}

// DELETE — remove the document row and its stored object (if any).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id, docId } = await params

    const { data: doc } = await supabase
      .from('engagement_documents')
      .select('file_path')
      .eq('id', docId)
      .eq('engagement_id', id)
      .maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    if (doc.file_path) {
      await supabase.storage.from('engagement-docs').remove([doc.file_path]).then(() => {}, () => {})
    }
    const { error } = await supabase.from('engagement_documents').delete().eq('id', docId).eq('engagement_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete document' }, { status: 500 })
  }
}
