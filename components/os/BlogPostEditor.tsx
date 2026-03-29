'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  blogMarkdownClassName,
  parseTagList,
  slugifyBlogTitle,
} from '@/lib/blog'
import { buildMarketingSiteUrl } from '@/lib/site'
import type { BlogPost } from '@/lib/types'

interface BlogPostEditorProps {
  mode: 'create' | 'edit'
  initialPost?: BlogPost | null
  isLocalhost: boolean
}

const inputClassName =
  'w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10'

export default function BlogPostEditor({
  mode,
  initialPost,
  isLocalhost,
}: BlogPostEditorProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initialPost?.title ?? '')
  const [slug, setSlug] = useState(initialPost?.slug ?? '')
  const [slugDirty, setSlugDirty] = useState(Boolean(initialPost?.slug))
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? '')
  const [tags, setTags] = useState(initialPost?.tags.join(', ') ?? '')
  const [body, setBody] = useState(initialPost?.body ?? '')
  const [published, setPublished] = useState(initialPost?.published ?? false)
  const [preview, setPreview] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    if (!slugDirty) {
      setSlug(slugifyBlogTitle(title))
    }
  }, [title, slugDirty])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSavedMessage('')

    if (!title.trim() || !slug.trim() || !body.trim()) {
      setSaving(false)
      setError('Title, slug, and body are required.')
      return
    }

    const endpoint =
      mode === 'create' ? '/api/os/blog' : `/api/os/blog/${initialPost?.id}`
    const method = mode === 'create' ? 'POST' : 'PATCH'

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          slug,
          excerpt,
          tags: parseTagList(tags),
          body,
          published,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save post')
      }

      const savedPost = payload.post as BlogPost | undefined

      if (!savedPost) {
        throw new Error('The save completed without a blog post payload.')
      }

      if (mode === 'create') {
        router.push(`/blog/${savedPost.id}/edit`)
        return
      }

      setSavedMessage('Saved')
      router.refresh()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to save post'
      )
    } finally {
      setSaving(false)
    }
  }

  const publishedUrl =
    initialPost?.published && initialPost.slug
      ? buildMarketingSiteUrl(`/blog/${initialPost.slug}`, isLocalhost)
      : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Content
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-50">
            {mode === 'create' ? 'New blog post' : 'Edit blog post'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {publishedUrl ? (
            <Link
              href={publishedUrl}
              target={isLocalhost ? undefined : '_blank'}
              rel={isLocalhost ? undefined : 'noreferrer'}
              className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-400 hover:text-white"
            >
              View on site →
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setPreview((current) => !current)}
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            {preview ? 'Hide preview' : 'Show preview'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6 rounded-[28px] border border-slate-800 bg-slate-900/60 p-6">
            <div>
              <label
                htmlFor="blog-title"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Title
              </label>
              <input
                id="blog-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label
                htmlFor="blog-slug"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Slug
              </label>
              <input
                id="blog-slug"
                value={slug}
                onChange={(event) => {
                  setSlugDirty(true)
                  setSlug(event.target.value)
                }}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label
                htmlFor="blog-excerpt"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Excerpt
              </label>
              <textarea
                id="blog-excerpt"
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                className={`${inputClassName} min-h-28 resize-y`}
              />
            </div>

            <div>
              <label
                htmlFor="blog-tags"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Tags
              </label>
              <input
                id="blog-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="ngp, consulting, app-dev"
                className={inputClassName}
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={published}
                onChange={(event) => setPublished(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-500 focus:ring-sky-500"
              />
              Published
            </label>
          </div>

          <div className="space-y-4 rounded-[28px] border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between">
              <label
                htmlFor="blog-body"
                className="text-sm font-medium text-slate-300"
              >
                Body
              </label>
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Markdown
              </span>
            </div>

            <div className={`grid gap-4 ${preview ? 'lg:grid-cols-2' : ''}`}>
              <textarea
                id="blog-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className={`${inputClassName} min-h-[460px] resize-y font-mono text-[13px] leading-6`}
                required
              />

              {preview ? (
                <div className="min-h-[460px] rounded-3xl border border-slate-800 bg-white p-6">
                  <div className={blogMarkdownClassName}>
                    <ReactMarkdown>
                      {body || 'Nothing to preview yet.'}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {savedMessage ? (
          <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {savedMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-70"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  )
}
