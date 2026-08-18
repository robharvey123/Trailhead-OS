import type { SeoArticle, SeoSite } from '@/lib/types'

/**
 * Publishing adapters behind one interface (Growth Phase 4).
 *
 * - github:    opens a PR adding an MDX file to the site repo's content dir —
 *              the right gate for a Next.js site (Vercel preview + review).
 * - wordpress: creates a DRAFT post via the REST API with an application
 *              password. Never publishes live — a human presses publish in
 *              WP admin. Client domains are never auto-published.
 *
 * Credentials are server-side only: the GitHub token comes from
 * GITHUB_PUBLISH_TOKEN (env), WordPress app passwords live in the admin-only
 * seo_sites.cms_config. Nothing here is ever NEXT_PUBLIC.
 */

export interface PublishResult {
  /** Where the article will live once merged/published. */
  url: string
  /** The PR URL (github) or post id (wordpress) — stored as publish_ref. */
  ref: string
}

interface GithubCmsConfig {
  repo?: string // "owner/name"
  base_branch?: string
  content_dir?: string
  author?: string // frontmatter author, e.g. "Rob Harvey"
}

interface WordpressCmsConfig {
  base_url?: string
  username?: string
  app_password?: string
}

export async function publishArticle(article: SeoArticle, site: SeoSite): Promise<PublishResult> {
  if (!article.body_mdx) throw new Error('Article has no body to publish')
  if (!article.slug) throw new Error('Article has no slug')

  switch (site.cms_type) {
    case 'github':
      return publishViaGithubPr(article, site)
    case 'wordpress':
      return publishViaWordpressDraft(article, site)
    case 'internal':
      return publishToInternalBlog(article)
    default:
      throw new Error('Set the site’s CMS in settings before publishing (GitHub, WordPress, or the Trailhead marketing blog)')
  }
}

// ── Internal: draft in this app's own blog_posts (trailheadholdings.uk) ─────

/** The marketing blog is database-backed, not MDX — so publishing to it is an
 *  insert, gated the same way as WordPress: an UNPUBLISHED draft Rob reviews
 *  in the /blog editor and publishes from there. */
async function publishToInternalBlog(article: SeoArticle): Promise<PublishResult> {
  const { createClient } = await import('@/lib/supabase/service')
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('slug', article.slug)
    .maybeSingle()
  if (existing) {
    throw new Error(`A blog post with slug "${article.slug}" already exists — change the slug or edit that post`)
  }

  const { data: post, error } = await supabase
    .from('blog_posts')
    .insert({
      slug: article.slug,
      title: article.title,
      excerpt: article.meta_description ?? null,
      body: article.body_mdx,
      published: false,
      tags: ['growth'],
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  return { url: `https://trailheadholdings.uk/blog/${article.slug}`, ref: `blog:${post.id}` }
}

// ── GitHub: branch + MDX file + pull request ────────────────────────────────

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub ${path} failed (${res.status}): ${body.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

function mdxFile(article: SeoArticle, slug: string, author?: string): string {
  // Frontmatter matches the engineer-os blog contract (lib/blog/posts.ts there):
  // title/description/slug/date/author/tags/draft; the PR is the review gate,
  // so draft is false — the post is live the moment the PR merges.
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(article.title)}`,
    `description: ${JSON.stringify(article.meta_description ?? '')}`,
    `slug: ${JSON.stringify(slug)}`,
    `date: ${JSON.stringify(new Date().toISOString().slice(0, 10))}`,
    ...(author ? [`author: ${JSON.stringify(author)}`] : []),
    'tags: ["growth"]',
    'draft: false',
    '---',
    '',
  ].join('\n')
  return frontmatter + article.body_mdx
}

async function publishViaGithubPr(article: SeoArticle, site: SeoSite): Promise<PublishResult> {
  const token = process.env.GITHUB_PUBLISH_TOKEN
  if (!token) throw new Error('GITHUB_PUBLISH_TOKEN is not configured')
  const slug = article.slug
  if (!slug) throw new Error('Article has no slug')

  const config = (site.cms_config ?? {}) as GithubCmsConfig
  const repo = config.repo
  if (!repo || !repo.includes('/')) {
    throw new Error('Set cms_config.repo ("owner/name") in the site settings first')
  }
  const baseBranch = config.base_branch ?? 'main'
  const contentDir = (config.content_dir ?? 'content/blog').replace(/^\/|\/$/g, '')
  // Date-prefixed filename per the target repo's convention (slug still comes
  // from frontmatter, so the URL is stable regardless).
  const filePath = `${contentDir}/${new Date().toISOString().slice(0, 10)}-${slug}.mdx`

  const baseRef = await gh<{ object: { sha: string } }>(
    token,
    `/repos/${repo}/git/ref/${encodeURIComponent(`heads/${baseBranch}`)}`
  )

  // Branch names must be unique — suffix a timestamp so republish attempts
  // never collide with an old branch.
  const branch = `seo/${slug}-${Date.now().toString(36)}`
  await gh(token, `/repos/${repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
  })

  await gh(token, `/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `content: add "${article.title}"`,
      content: Buffer.from(mdxFile(article, slug, config.author), 'utf8').toString('base64'),
      branch,
    }),
  })

  const pr = await gh<{ html_url: string }>(token, `/repos/${repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: `Article: ${article.title}`,
      head: branch,
      base: baseBranch,
      body: [
        `Adds \`${filePath}\` from the Growth engine.`,
        '',
        article.meta_description ? `> ${article.meta_description}` : '',
        '',
        `Target keyword: ${slug.replace(/-/g, ' ')} · ${article.word_count ?? '?'} words.`,
        'Preview deploy will render the article; merge to publish.',
      ].join('\n'),
    }),
  })

  return { url: `https://${site.domain}/blog/${slug}`, ref: pr.html_url }
}

/** Squash-merge a publish PR from inside the OS — the human gate already
 *  happened at approve + publish, so this is one less GitHub round-trip, not an
 *  approval bypass. Deletes the seo/* branch afterwards (best-effort). */
export async function mergePublishPr(prUrl: string): Promise<string> {
  const token = process.env.GITHUB_PUBLISH_TOKEN
  if (!token) throw new Error('GITHUB_PUBLISH_TOKEN is not configured')

  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) throw new Error(`Not a GitHub PR URL: ${prUrl}`)
  const [, owner, repo, number] = match

  const pr = await gh<{ merged: boolean; state: string; head: { ref: string } }>(
    token,
    `/repos/${owner}/${repo}/pulls/${number}`
  )
  if (pr.merged) return 'Already merged — the article is live (or deploying).'
  if (pr.state !== 'open') throw new Error('The pull request is closed without being merged — reopen it on GitHub first')

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/merge`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ merge_method: 'squash' }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    // 405 = not mergeable (checks pending / conflict) — surface GitHub's reason.
    throw new Error(body.message ?? `Merge failed (${res.status})`)
  }

  // Tidy the seo/* branch; a failure here never fails the merge.
  await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${pr.head.ref}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  }).catch(() => undefined)

  return 'Merged — the article goes live when the site deploy finishes.'
}

// ── WordPress: draft post via REST + application password ───────────────────

/** Minimal markdown → HTML for the WP draft body. The draft is reviewed in the
 *  WP editor before publishing, so this only needs to be readable, not perfect. */
export function markdownToHtml(md: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s: string) =>
    escape(s)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')

  const blocks = md.split(/\n{2,}/)
  return blocks
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      const heading = trimmed.match(/^(#{1,4})\s+(.*)$/)
      if (heading && !trimmed.includes('\n')) {
        const level = heading[1].length
        return `<h${level}>${inline(heading[2])}</h${level}>`
      }
      if (trimmed.split('\n').every((l) => /^[-*]\s+/.test(l))) {
        const items = trimmed.split('\n').map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`)
        return `<ul>${items.join('')}</ul>`
      }
      if (trimmed.split('\n').every((l) => /^\d+\.\s+/.test(l))) {
        const items = trimmed.split('\n').map((l) => `<li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`)
        return `<ol>${items.join('')}</ol>`
      }
      return `<p>${inline(trimmed).replace(/\n/g, '<br />')}</p>`
    })
    .filter(Boolean)
    .join('\n')
}

async function publishViaWordpressDraft(article: SeoArticle, site: SeoSite): Promise<PublishResult> {
  const config = (site.cms_config ?? {}) as WordpressCmsConfig
  if (!config.base_url || !config.username || !config.app_password) {
    throw new Error('Set cms_config base_url, username and app_password in the site settings first')
  }
  const base = config.base_url.replace(/\/$/, '')
  const auth = Buffer.from(`${config.username}:${config.app_password}`).toString('base64')

  const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: article.title,
      slug: article.slug,
      // Always a draft — never auto-publish to a client domain.
      status: 'draft',
      content: markdownToHtml(article.body_mdx ?? ''),
      excerpt: article.meta_description ?? '',
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WordPress draft failed (${res.status}): ${body.slice(0, 300)}`)
  }
  const post = (await res.json()) as { id: number; link: string }
  return { url: post.link, ref: String(post.id) }
}
