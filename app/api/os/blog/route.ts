import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { parseBlogPostPayload } from '@/lib/blog-payload'
import { createBlogPost, getAllBlogPosts } from '@/lib/db/blog-posts'

export async function GET() {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  try {
    const posts = await getAllBlogPosts(auth.supabase)
    return NextResponse.json({ posts })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load blog posts',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const payload = parseBlogPostPayload(body)

  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: 400 })
  }

  try {
    const post = await createBlogPost(payload.value, auth.supabase)
    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create blog post',
      },
      { status: 500 }
    )
  }
}
