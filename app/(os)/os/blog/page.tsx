import Link from 'next/link'
import { headers } from 'next/headers'
import { formatBlogDate } from '@/lib/blog'
import { getAllBlogPosts } from '@/lib/db/blog-posts'
import { createClient } from '@/lib/supabase/server'
import { buildMarketingSiteUrl, isLocalDevelopmentHost } from '@/lib/site'
import PageHeader from '@/components/ui/PageHeader'

export default async function OsBlogPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const supabase = await createClient()
  const posts = await getAllBlogPosts(supabase).catch(() => [])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Blog"
        actions={
          <Link
            href="/blog/new"
            className="btn btn-primary"
          >
            New post
          </Link>
        }
      />

      <div className="os-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border)] text-left">
            <thead className="bg-[var(--surface)]">
              <tr>
                <th className="os-label px-6 py-3">Title</th>
                <th className="os-label px-6 py-3">Tags</th>
                <th className="os-label px-6 py-3">Published date</th>
                <th className="os-label px-6 py-3">Status</th>
                <th className="os-label px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)] text-sm text-[color:var(--text-2)]">
              {posts.map((post) => (
                <tr key={post.id} className="align-top">
                  <td className="px-6 py-5">
                    <div>
                      <p className="font-semibold text-[color:var(--text)]">
                        {post.title}
                      </p>
                      <p className="mt-1 max-w-md text-[color:var(--text-2)]">
                        {post.excerpt || 'No excerpt yet.'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex max-w-xs flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="tag-chip"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-[color:var(--text-2)]">
                    {formatBlogDate(post.published_at)}
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`status-badge ${post.published ? 'status-emerald' : 'status-grey'}`}
                    >
                      {post.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-4">
                      <Link
                        href={`/blog/${post.id}/edit`}
                        className="font-semibold text-[color:var(--accent-strong)] transition hover:text-[color:var(--accent-hover)]"
                      >
                        Edit
                      </Link>
                      {post.published ? (
                        <Link
                          href={buildMarketingSiteUrl(
                            `/blog/${post.slug}`,
                            isLocalhost
                          )}
                          target={isLocalhost ? undefined : '_blank'}
                          rel={isLocalhost ? undefined : 'noreferrer'}
                          className="font-semibold text-[color:var(--text-2)] transition hover:text-[color:var(--text)]"
                        >
                          View on site
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}

              {posts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-[color:var(--text-2)]"
                  >
                    No blog posts yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
