import Link from 'next/link'
import { headers } from 'next/headers'
import { formatBlogDate } from '@/lib/blog'
import { getAllBlogPosts } from '@/lib/db/blog-posts'
import { createClient } from '@/lib/supabase/server'
import { buildMarketingSiteUrl, isLocalDevelopmentHost } from '@/lib/site'

export default async function OsBlogPage() {
  const host = (await headers()).get('host') || ''
  const isLocalhost = isLocalDevelopmentHost(host)
  const supabase = await createClient()
  const posts = await getAllBlogPosts(supabase).catch(() => [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="os-eyebrow">
            Content
          </p>
          <h1 className="os-page-title mt-2">
            Blog
          </h1>
        </div>
        <Link
          href="/blog/new"
          className="inline-flex items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
        >
          New post
        </Link>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border)] text-left">
            <thead className="bg-[var(--surface)] text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">
              <tr>
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Tags</th>
                <th className="px-6 py-4 font-medium">Published date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Actions</th>
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
                          className="rounded-full border border-[color:var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-2)]"
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
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        post.published
                          ? 'bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]'
                          : 'bg-[var(--surface-2)] text-[color:var(--text-2)]'
                      }`}
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
