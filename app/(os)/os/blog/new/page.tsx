import { headers } from 'next/headers'
import BlogPostEditor from '@/components/os/BlogPostEditor'
import { isLocalDevelopmentHost } from '@/lib/site'

export default async function NewBlogPostPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)

  return <BlogPostEditor mode="create" isLocalhost={isLocalhost} />
}
