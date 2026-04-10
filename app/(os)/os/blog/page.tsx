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
          <p className="text-xs uppercase tracking-[0.28em] text-white0">
            Content
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
            Blog
          </h1>
        </div>
        <Link
          href="/blog/new"
          className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          New post
        </Link>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-[#2A2A3A] bg-[#1A1A28]/60">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#2A2A3A] text-left">
            <thead className="bg-[#13131E] text-xs uppercase tracking-[0.2em] text-white0">
              <tr>
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Tags</th>
                <th className="px-6 py-4 font-medium">Published date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A3A] text-sm text-[#9CA3AF]">
              {posts.map((post) => (
                <tr key={post.id} className="align-top">
                  <td className="px-6 py-5">
                    <div>
                      <p className="font-semibold text-white">
                        {post.title}
                      </p>
                      <p className="mt-1 max-w-md text-[#9CA3AF]">
                        {post.excerpt || 'No excerpt yet.'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex max-w-xs flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-[#2A2A3A] bg-[#13131E] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-[#9CA3AF]">
                    {formatBlogDate(post.published_at)}
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        post.published
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : 'bg-[#2A2A3A]/60 text-[#9CA3AF]'
                      }`}
                    >
                      {post.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-4">
                      <Link
                        href={`/blog/${post.id}/edit`}
                        className="font-semibold text-sky-300 transition hover:text-sky-200"
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
                          className="font-semibold text-[#9CA3AF] transition hover:text-white"
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
                    className="px-6 py-10 text-center text-[#9CA3AF]"
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
