// app/(marketing)/marketing/blog/[slug]/opengraph-image.tsx
// Per-post OG image using the post title from Supabase.

import { ImageResponse } from 'next/og'
import { getPublishedBlogPostBySlug } from '@/lib/db/blog-posts'

export const runtime = 'edge'
export const alt = 'Trailhead Holdings blog post'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Props = { params: Promise<{ slug: string }> }

export default async function PostOgImage({ params }: Props) {
  const { slug } = await params
  let title = 'Trailhead Holdings'
  try {
    const post = await getPublishedBlogPostBySlug(slug)
    if (post?.title) title = post.title
  } catch {
    // fall back to default title
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: 'linear-gradient(135deg, #0b1220 0%, #1a2840 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 28,
            opacity: 0.7,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Trailhead Holdings · Blog
        </div>
        <div
          style={{
            fontSize: title.length > 60 ? 56 : 72,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 24, opacity: 0.7 }}>trailheadholdings.uk/blog</div>
      </div>
    ),
    { ...size }
  )
}
