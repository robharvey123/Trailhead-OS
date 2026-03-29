import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import BlogPostEditor from '@/components/os/BlogPostEditor'
import { getBlogPostById } from '@/lib/db/blog-posts'
import { createClient } from '@/lib/supabase/server'
import { isLocalDevelopmentHost } from '@/lib/site'

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const supabase = await createClient()
  const post = await getBlogPostById(id, supabase).catch(() => null)

  if (!post) {
    notFound()
  }

  return (
    <BlogPostEditor mode="edit" initialPost={post} isLocalhost={isLocalhost} />
  )
}
