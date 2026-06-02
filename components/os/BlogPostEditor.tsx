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
  'w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text)] outline-none transition placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[var(--accent-dim)]'

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
          <p className="os-eyebrow">
            Content
          </p>
          <h1 className="os-page-title mt-2 tracking-[-0.04em]">
            {mode === 'create' ? 'New blog post' : 'Edit blog post'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {publishedUrl ? (
            <Link
              href={publishedUrl}
              target={isLocalhost ? undefined : '_blank'}
              rel={isLocalhost ? undefined : 'noreferrer'}
              className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--text)]"
            >
              View on site →
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setPreview((current) => !current)}
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--text)]"
          >
            {preview ? 'Hide preview' : 'Show preview'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="os-card space-y-6 p-6">
            <div>
              <label
                htmlFor="blog-title"
                className="mb-2 block text-sm font-medium text-[color:var(--text-2)]"
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
                className="mb-2 block text-sm font-medium text-[color:var(--text-2)]"
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
                className="mb-2 block text-sm font-medium text-[color:var(--text-2)]"
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
                className="mb-2 block text-sm font-medium text-[color:var(--text-2)]"
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

            <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text-2)]">
              <input
                type="checkbox"
                checked={published}
                onChange={(event) => setPublished(event.target.checked)}
                className="h-4 w-4 rounded border-[color:var(--border)] bg-[var(--bg)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
              />
              Published
            </label>
          </div>

          <div className="os-card space-y-4 p-6">
            <div className="flex items-center justify-between">
              <label
                htmlFor="blog-body"
                className="text-sm font-medium text-[color:var(--text-2)]"
              >
                Body
              </label>
              <span className="os-eyebrow">
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
                <div className="min-h-[460px] rounded-3xl border border-[color:var(--border)] bg-white p-6">
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
          <p className="rounded-2xl border border-[color:var(--red)] bg-[var(--red-dim)] px-4 py-3 text-sm text-[color:var(--red-strong)]">
            {error}
          </p>
        ) : null}

        {savedMessage ? (
          <p className="rounded-2xl border border-[color:var(--emerald)] bg-[var(--emerald-dim)] px-4 py-3 text-sm text-[color:var(--emerald-strong)]">
            {savedMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  )
}
