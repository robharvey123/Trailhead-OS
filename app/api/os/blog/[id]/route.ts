import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { parseBlogPostPayload } from '@/lib/blog-payload'
import {
  deleteBlogPost,
  getBlogPostById,
  updateBlogPost,
} from '@/lib/db/blog-posts'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await context.params

  try {
    const post = await getBlogPostById(id, auth.supabase)

    if (!post) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ post })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load blog post',
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await context.params

  try {
    const existing = await getBlogPostById(id, auth.supabase)

    if (!existing) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const payload = parseBlogPostPayload(body, existing)

    if (!payload.ok) {
      return NextResponse.json({ error: payload.error }, { status: 400 })
    }

    const post = await updateBlogPost(id, payload.value, auth.supabase)
    return NextResponse.json({ post })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update blog post',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await context.params

  try {
    const existing = await getBlogPostById(id, auth.supabase)

    if (!existing) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      )
    }

    await deleteBlogPost(id, auth.supabase)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to delete blog post',
      },
      { status: 500 }
    )
  }
}
