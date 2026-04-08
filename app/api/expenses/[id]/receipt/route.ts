import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: expense, error } = await supabase
      .from('expenses')
      .select('receipt_url')
      .eq('id', id)
      .single()

    if (error || !expense?.receipt_url) {
      return NextResponse.json({ error: 'No receipt found' }, { status: 404 })
    }

    // receipt_url stores the storage path, create a signed URL
    const { data: signedData, error: signError } = await supabase.storage
      .from('receipts')
      .createSignedUrl(expense.receipt_url, 60 * 60) // 1 hour

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: signError?.message || 'Failed to generate signed URL' },
        { status: 500 }
      )
    }

    return NextResponse.redirect(signedData.signedUrl)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get receipt' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload receipt' },
        { status: 500 }
      )
    }

    // Store the storage path, not a public URL
    const { error: updateError } = await supabase
      .from('expenses')
      .update({ receipt_url: path })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to save receipt URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ receipt_url: path })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to upload receipt' },
      { status: 500 }
    )
  }
}
