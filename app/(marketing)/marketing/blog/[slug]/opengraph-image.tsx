// app/(marketing)/marketing/blog/[slug]/opengraph-image.tsx
// Per-post OG card using the post title from Supabase. See lib/og.tsx.

import { ImageResponse } from 'next/og'
import { getPublishedBlogPostBySlug } from '@/lib/db/blog-posts'
import { OG, OG_SIZE, OgCard, loadArchivo } from '@/lib/og'

export const runtime = 'edge'
export const alt = 'Trailhead Holdings blog post'
export const size = OG_SIZE
export const contentType = 'image/png'

type Props = { params: Promise<{ slug: string }> }

export default async function PostOgImage({ params }: Props) {
  const { slug } = await params
  let title = 'Trailhead Holdings'
  try {
    const post = await getPublishedBlogPostBySlug(slug)
    if (post?.title) title = post.title
  } catch {
    // fall back to the default title
  }

  const fonts = await loadArchivo()

  return new ImageResponse(
    (
      <OgCard wordmark="Notes" footer="trailheadholdings.uk/blog">
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 60 ? 60 : 74,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            color: OG.ink,
          }}
        >
          {title}
        </div>
      </OgCard>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  )
}
