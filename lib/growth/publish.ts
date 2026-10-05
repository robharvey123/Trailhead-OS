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
  await assertSlugIsFree(article)

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

/**
 * Refuse to publish over another article's slug on the same site.
 *
 * Approving a brief twice inserts a second seo_articles row with the same slug
 * (there is no uniqueness on it), and the GitHub filename is date-prefixed — so
 * publishing the duplicate on a different day does not collide on the filename,
 * it quietly adds a SECOND content file carrying the same frontmatter slug. The
 * site then has two pages competing for one URL, which is worse than an error.
 * Checked for every CMS, since the internal blog and WordPress have the same
 * problem by a different route.
 */
async function assertSlugIsFree(article: SeoArticle): Promise<void> {
  const { createClient } = await import('@/lib/supabase/service')
  const supabase = createClient()
  const { data, error } = await supabase
    .from('seo_articles')
    .select('id, title, status')
    .eq('site_id', article.site_id)
    .eq('slug', article.slug)
    .neq('id', article.id)
    .in('status', ['approved', 'published'])
    .limit(1)
  if (error) throw new Error(error.message)
  const clash = (data ?? [])[0] as { title: string; status: string } | undefined
  if (clash) {
    throw new Error(
      `Another article on this site already uses the slug "${article.slug}" — "${clash.title}" (${clash.status}). ` +
        'Change this article\'s slug, or archive the other one, before publishing.'
    )
  }
}

/**
 * Record the branch and file a publish attempt owns, the moment the branch
 * exists. Everything after that point can fail, and without this the next click
 * cuts a fresh branch and opens a second PR instead of resuming this one.
 */
async function recordPublishAttempt(articleId: string, branch: string, path: string): Promise<void> {
  const { createClient } = await import('@/lib/supabase/service')
  const supabase = createClient()
  await supabase
    .from('seo_articles')
    .update({ publish_branch: branch, publish_path: path })
    .eq('id', articleId)
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

function ghHeaders(token: string, hasBody: boolean): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  }
}

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: ghHeaders(token, Boolean(init?.body)),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub ${path} failed (${res.status}): ${body.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

/** GET where "not there" is an expected answer: 404 returns null, not a throw. */
async function ghOptional<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`https://api.github.com${path}`, { headers: ghHeaders(token, false) })
  if (res.status === 404) return null
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

  // Both of these are sticky once an attempt has started. The branch name is
  // DELIBERATELY deterministic (it used to carry a timestamp, which guaranteed a
  // fresh branch per click and so made resuming impossible), and the file path
  // is remembered because the default name is date-prefixed per the target
  // repo's convention — recomputing it the next day would write a second file
  // for the same article. Slug still comes from frontmatter, so the public URL
  // does not depend on either.
  const branch = article.publish_branch ?? `seo/${slug}`
  const filePath =
    article.publish_path ?? `${contentDir}/${new Date().toISOString().slice(0, 10)}-${slug}.mdx`
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')

  // ── 1. Branch: reuse it if a previous attempt left it behind ──────────────
  const existingBranch = await ghOptional<{ object: { sha: string } }>(
    token,
    `/repos/${repo}/git/ref/${encodeURIComponent(`heads/${branch}`)}`
  )
  if (!existingBranch) {
    const baseRef = await gh<{ object: { sha: string } }>(
      token,
      `/repos/${repo}/git/ref/${encodeURIComponent(`heads/${baseBranch}`)}`
    )
    await gh(token, `/repos/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
    })
  }

  // The branch exists from here on, so claim it before anything else can fail.
  await recordPublishAttempt(article.id, branch, filePath)

  // ── 2. File: GitHub needs the blob sha to overwrite an existing path ──────
  // Without it the PUT fails 422 "sha wasn't supplied", which is what happened
  // whenever the file was already on the branch — either left by an earlier
  // attempt, or inherited from base because a previous PR had merged it.
  const existingFile = await ghOptional<{ sha: string }>(
    token,
    `/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
  )
  await gh(token, `/repos/${repo}/contents/${encodedPath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `content: ${existingFile ? 'update' : 'add'} "${article.title}"`,
      content: Buffer.from(mdxFile(article, slug, config.author), 'utf8').toString('base64'),
      branch,
      ...(existingFile ? { sha: existingFile.sha } : {}),
    }),
  })

  // ── 3. PR: reuse the open one for this branch rather than stacking another ─
  const owner = repo.split('/')[0]
  const openPrs = await gh<Array<{ html_url: string }>>(
    token,
    `/repos/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`
  )
  const existingPr = openPrs[0]
  if (existingPr) {
    return { url: `https://${site.domain}/blog/${slug}`, ref: existingPr.html_url }
  }

  let pr: { html_url: string }
  try {
    pr = await gh<{ html_url: string }>(token, `/repos/${repo}/pulls`, {
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
  } catch (err) {
    // Reusing a branch whose PR already merged, with content that has not
    // changed since, leaves nothing to open a PR about. Say so plainly rather
    // than passing GitHub's wording through.
    if (err instanceof Error && /No commits between/i.test(err.message)) {
      throw new Error(
        `This article is already merged into ${baseBranch} as ${filePath} and nothing has changed since. ` +
          'Regenerate it first if you want a new version.'
      )
    }
    throw err
  }

  return { url: `https://${site.domain}/blog/${slug}`, ref: pr.html_url }
}

// ── D3: refresh an existing article as a PR ─────────────────────────────────

export interface RefreshChanges {
  title?: string
  meta_description?: string
  /** Markdown sections appended before the FAQ (or at the end). */
  sections?: Array<{ heading: string; body: string }>
}

interface GithubFile {
  path: string
  sha: string
  content: string
}

/** Locate the MDX file for a published URL: an explicit path map on the site
 *  row (cms_config.path_map[url]), else a content-dir search on the slug. */
async function locateArticleFile(token: string, repo: string, contentDir: string, site: SeoSite, publishedUrl: string): Promise<GithubFile> {
  const config = (site.cms_config ?? {}) as { path_map?: Record<string, string> }
  let path = config.path_map?.[publishedUrl]
  if (!path) {
    const slug = publishedUrl.replace(/\/$/, '').split('/').pop() ?? ''
    if (!slug) throw new Error('Could not derive a slug from the published URL')
    const listing = await gh<Array<{ name: string; path: string }>>(token, `/repos/${repo}/contents/${contentDir}`)
    const match = listing.find((f) => f.name === `${slug}.mdx` || f.name === `${slug}.md` || f.name.endsWith(`-${slug}.mdx`) || f.name.endsWith(`-${slug}.md`))
    if (!match) throw new Error(`No file matching "${slug}" in ${contentDir}`)
    path = match.path
  }
  const file = await gh<{ sha: string; content: string; encoding: string }>(token, `/repos/${repo}/contents/${path}`)
  return { path, sha: file.sha, content: Buffer.from(file.content, 'base64').toString('utf8') }
}

/** Apply approved change-list items to frontmatter + body. */
export function applyRefreshToMdx(source: string, changes: RefreshChanges): string {
  const fm = source.match(/^---\n([\s\S]*?)\n---\n?/)
  let frontmatter = fm ? fm[1] : ''
  let body = fm ? source.slice(fm[0].length) : source
  const setKey = (key: string, value: string) => {
    const line = `${key}: ${JSON.stringify(value)}`
    frontmatter = new RegExp(`^${key}:`, 'm').test(frontmatter) ? frontmatter.replace(new RegExp(`^${key}:.*$`, 'm'), line) : `${frontmatter}\n${line}`.replace(/^\n/, '')
  }
  if (changes.title) {
    setKey('title', changes.title)
    body = body.replace(/^# .*$/m, `# ${changes.title}`)
  }
  if (changes.meta_description) setKey('description', changes.meta_description)
  if (changes.sections && changes.sections.length > 0) {
    const block = changes.sections.map((s) => `\n## ${s.heading}\n\n${s.body.trim()}\n`).join('')
    const faq = body.search(/^##\s+(FAQ|Frequently asked)/im)
    body = faq >= 0 ? body.slice(0, faq) + block + '\n' + body.slice(faq) : body.trimEnd() + '\n' + block
  }
  return (frontmatter ? `---\n${frontmatter}\n---\n` : '') + body
}

/** Open a "Refresh: {title}" PR applying the approved change list. Same review
 *  gate as new content — nothing goes live unreviewed. */
export async function updateArticle(site: SeoSite, publishedUrl: string, title: string, changes: RefreshChanges): Promise<PublishResult> {
  if (site.cms_type === 'wordpress') return updateWordpressAsDraft(site, publishedUrl, title, changes)
  if (site.cms_type !== 'github') throw new Error('Refresh PRs need a GitHub-published site (WordPress sites get a revision draft)')
  const token = process.env.GITHUB_PUBLISH_TOKEN
  if (!token) throw new Error('GITHUB_PUBLISH_TOKEN is not configured')
  const config = (site.cms_config ?? {}) as GithubCmsConfig
  const repo = config.repo
  if (!repo || !repo.includes('/')) throw new Error('Set cms_config.repo ("owner/name") in the site settings first')
  const baseBranch = config.base_branch ?? 'main'
  const contentDir = (config.content_dir ?? 'content/blog').replace(/^\/|\/$/g, '')

  const file = await locateArticleFile(token, repo, contentDir, site, publishedUrl)
  const updated = applyRefreshToMdx(file.content, changes)
  if (updated === file.content) throw new Error('No approved changes to apply')

  const baseRef = await gh<{ object: { sha: string } }>(token, `/repos/${repo}/git/ref/${encodeURIComponent(`heads/${baseBranch}`)}`)
  const slug = file.path.split('/').pop()?.replace(/\.mdx?$/, '') ?? 'article'
  const branch = `seo/refresh-${slug}-${Date.now().toString(36)}`
  await gh(token, `/repos/${repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }) })
  await gh(token, `/repos/${repo}/contents/${file.path}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `content: refresh "${title}"`, content: Buffer.from(updated, 'utf8').toString('base64'), branch, sha: file.sha }),
  })
  const pr = await gh<{ html_url: string }>(token, `/repos/${repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: `Refresh: ${title}`,
      head: branch,
      base: baseBranch,
      body: [
        `Refreshes \`${file.path}\` from the Growth refresh worksheet.`,
        '',
        changes.title ? `- Title → ${changes.title}` : '',
        changes.meta_description ? `- Meta description → ${changes.meta_description}` : '',
        ...(changes.sections ?? []).map((s) => `- Added section: ${s.heading}`),
        '',
        'Preview deploy will render the change; merge to publish.',
      ].filter((l) => l !== null).join('\n'),
    }),
  })
  return { url: publishedUrl, ref: pr.html_url }
}

/** WordPress: never edit the live post — create a draft revision copy. */
async function updateWordpressAsDraft(site: SeoSite, publishedUrl: string, title: string, changes: RefreshChanges): Promise<PublishResult> {
  const config = (site.cms_config ?? {}) as WordpressCmsConfig
  if (!config.base_url || !config.username || !config.app_password) throw new Error('WordPress base_url, username and app password are required')
  const auth = `Basic ${Buffer.from(`${config.username}:${config.app_password}`).toString('base64')}`
  const base = config.base_url.replace(/\/$/, '')
  const slug = publishedUrl.replace(/\/$/, '').split('/').pop() ?? ''
  const search = await fetch(`${base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&context=edit`, { headers: { Authorization: auth } })
  if (!search.ok) throw new Error(`WordPress lookup failed (${search.status})`)
  const posts = (await search.json()) as Array<{ id: number; content?: { raw?: string }; excerpt?: { raw?: string } }>
  const post = posts[0]
  if (!post) throw new Error(`No WordPress post with slug "${slug}"`)
  const extra = (changes.sections ?? []).map((s) => `<h2>${s.heading}</h2>${markdownToHtml(s.body)}`).join('')
  const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[REFRESH DRAFT] ${changes.title ?? title}`,
      status: 'draft',
      content: (post.content?.raw ?? '') + extra,
      excerpt: changes.meta_description ?? post.excerpt?.raw ?? '',
    }),
  })
  if (!res.ok) throw new Error(`WordPress draft failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  const draft = (await res.json()) as { id: number }
  return { url: publishedUrl, ref: String(draft.id) }
}

/** Squash-merge a publish PR from inside the OS — the human gate already
 *  happened at approve + publish, so this is one less GitHub round-trip, not an
 *  approval bypass. Deletes the seo/* branch afterwards (best-effort). */
// ── Commit checks: never merge a PR whose build is failing ─────────────────

export interface PrCheckState {
  /** 'none' means the repo reports no checks at all — nothing to wait for. */
  state: 'success' | 'failure' | 'pending' | 'none'
  /** Failing contexts and where to read the build, for publish_error. */
  failures: Array<{ context: string; url: string | null }>
  headSha: string
}

/** Conclusions that mean "do not merge this". */
const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'])

/**
 * Checks that say nothing about whether the build succeeded, and so must not
 * count as a passing signal.
 *
 * "Vercel Preview Comments" is the trap. Vercel registers it within about a
 * second of a PR opening and immediately completes it `success`, while the
 * actual build reports separately as a commit status with context "Vercel" and
 * takes seconds to minutes. Any gate that merges on "nothing is failing and
 * something passed" therefore merges before the build has said a word — which
 * is exactly how PR #10 merged 7 seconds after opening, into a failed build.
 */
const COSMETIC_CHECK_NAMES = new Set(['Vercel Preview Comments'])

/** The commit-status context Vercel reports the deployment under. */
const VERCEL_BUILD_CONTEXT = 'Vercel'

function parsePrUrl(prUrl: string): { owner: string; repo: string; number: string } {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) throw new Error(`Not a GitHub PR URL: ${prUrl}`)
  return { owner: match[1], repo: match[2], number: match[3] }
}

/**
 * Combined verdict for a PR head, across BOTH of GitHub's check surfaces: the
 * legacy commit statuses (which is what Vercel posts, context "Vercel") and
 * check runs (GitHub Actions). Either one failing is a failure.
 */
export async function prChecks(prUrl: string): Promise<PrCheckState> {
  const token = process.env.GITHUB_PUBLISH_TOKEN
  if (!token) throw new Error('GITHUB_PUBLISH_TOKEN is not configured')
  const { owner, repo, number } = parsePrUrl(prUrl)

  const pr = await gh<{ head: { sha: string } }>(token, `/repos/${owner}/${repo}/pulls/${number}`)
  const sha = pr.head.sha

  const [status, checks] = await Promise.all([
    gh<{
      state: string
      statuses: Array<{ state: string; context: string; target_url: string | null }>
    }>(token, `/repos/${owner}/${repo}/commits/${sha}/status`),
    gh<{
      check_runs: Array<{
        name: string
        status: string
        conclusion: string | null
        html_url: string | null
        app?: { slug?: string } | null
      }>
    }>(token, `/repos/${owner}/${repo}/commits/${sha}/check-runs`),
  ])

  const failures: PrCheckState['failures'] = []
  let pending = false
  let signals = 0
  let vercelConnected = false
  let vercelBuildReported = false

  for (const entry of status.statuses ?? []) {
    if (entry.context === VERCEL_BUILD_CONTEXT) {
      vercelConnected = true
      // A pending Vercel status still counts as "has spoken": we know the build
      // exists and `pending` below makes us wait for its verdict.
      if (entry.state !== 'pending') vercelBuildReported = true
    }
    signals++
    if (entry.state === 'failure' || entry.state === 'error') {
      failures.push({ context: entry.context, url: entry.target_url })
    } else if (entry.state === 'pending') {
      pending = true
    }
  }
  for (const run of checks.check_runs ?? []) {
    // The Vercel app being present at all proves the repo deploys on Vercel, so
    // its build status is owed to us even before it appears.
    if (run.app?.slug === 'vercel') vercelConnected = true
    if (COSMETIC_CHECK_NAMES.has(run.name)) continue
    signals++
    if (run.status !== 'completed') {
      pending = true
    } else if (run.conclusion && FAILED_CONCLUSIONS.has(run.conclusion)) {
      failures.push({ context: run.name, url: run.html_url })
    }
  }

  if (failures.length > 0) return { state: 'failure', failures, headSha: sha }
  if (pending) return { state: 'pending', failures: [], headSha: sha }
  // Vercel is wired up but has not reported the deployment yet. NOT success:
  // this is the window PR #10 merged in.
  if (vercelConnected && !vercelBuildReported) return { state: 'pending', failures: [], headSha: sha }
  if (signals === 0) return { state: 'none', failures: [], headSha: sha }
  return { state: 'success', failures: [], headSha: sha }
}

/** How long to wait for a build before refusing to merge. Brookweald's preview
 *  takes about a minute; anything much longer is a problem to look at, not to
 *  merge through. */
const CHECK_WAIT_MS = 150_000
const CHECK_POLL_MS = 6_000

/**
 * How long "this PR reports no checks at all" has to hold before we believe it.
 *
 * This window is the whole bug. A PR that CI has not registered yet is
 * indistinguishable from a repo that has no CI — both report zero checks — and
 * a freshly opened PR is always in that state for a few seconds. Vercel's status
 * on PR #10 arrived 7 seconds after the PR opened, and the merge happened inside
 * that gap, so the gate saw nothing to wait for and merged a failing build.
 * Waiting out the gap costs a check-less repo one short pause per publish and
 * costs a Vercel-connected repo nothing, because its status arrives first.
 */
const CHECK_APPEAR_GRACE_MS = 45_000

/**
 * Poll until the PR head gives a verdict we can act on: a failure, a success,
 * or "no checks here" that survived the grace window above.
 */
export async function waitForPrChecks(prUrl: string): Promise<PrCheckState> {
  const started = Date.now()
  let last = await prChecks(prUrl)
  while (
    (last.state === 'pending' && Date.now() - started < CHECK_WAIT_MS) ||
    (last.state === 'none' && Date.now() - started < CHECK_APPEAR_GRACE_MS)
  ) {
    await new Promise((resolve) => setTimeout(resolve, CHECK_POLL_MS))
    last = await prChecks(prUrl)
  }
  return last
}

/** Thrown when checks block the merge, so callers can record it verbatim. */
export class ChecksBlockedMerge extends Error {
  constructor(message: string, readonly checks: PrCheckState) {
    super(message)
    this.name = 'ChecksBlockedMerge'
  }
}

/**
 * Merge a publish PR — but only once its checks pass.
 *
 * Gated here rather than in the callers because both routes to a merge (the
 * per-site auto_merge option and the manual button) run through this function,
 * and both merged with the token's identity, so neither could be told apart
 * after the fact. PR #10 on brookweald-site merged in the same second Vercel
 * reported a failed preview build, which broke main.
 */
export async function mergePublishPr(prUrl: string): Promise<string> {
  const token = process.env.GITHUB_PUBLISH_TOKEN
  if (!token) throw new Error('GITHUB_PUBLISH_TOKEN is not configured')

  const { owner, repo, number } = parsePrUrl(prUrl)

  const pr = await gh<{ merged: boolean; state: string; head: { ref: string } }>(
    token,
    `/repos/${owner}/${repo}/pulls/${number}`
  )
  if (pr.merged) return 'Already merged — the article is live (or deploying).'
  if (pr.state !== 'open') throw new Error('The pull request is closed without being merged — reopen it on GitHub first')

  const checks = await waitForPrChecks(prUrl)
  if (checks.state === 'failure') {
    const detail = checks.failures
      .map((f) => (f.url ? `${f.context} — ${f.url}` : f.context))
      .join('; ')
    throw new ChecksBlockedMerge(
      `Not merged: the build on this pull request failed (${detail}). The PR is still open — fix the build, then publish again.`,
      checks
    )
  }
  if (checks.state === 'pending') {
    throw new ChecksBlockedMerge(
      `Not merged: the build on this pull request was still running after ${Math.round(CHECK_WAIT_MS / 1000)}s. ` +
        `The PR is still open (${prUrl}) — publish again once it finishes.`,
      checks
    )
  }

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

// ── Publish verification: 'publishing' → 'published' only when the URL answers ─

/** Give up on an article that never goes live, rather than polling forever. */
const PUBLISH_VERIFY_GIVE_UP_MS = 6 * 60 * 60 * 1000

export interface VerifyResult {
  articleId: string
  outcome: 'published' | 'waiting' | 'blocked' | 'gave_up'
  detail: string
}

/** Does the published URL actually serve the article? */
export async function publishedUrlIsLive(url: string): Promise<{ live: boolean; status: number }> {
  try {
    // HEAD first (cheap); some hosts don't implement it, so fall back to GET.
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow' })
    }
    return { live: res.status === 200, status: res.status }
  } catch {
    return { live: false, status: 0 }
  }
}

/**
 * Advance one article in the 'publishing' state.
 *
 * The three things that have to be true before an article counts as published:
 * its PR is merged, its checks did not fail, and its URL returns 200. This is
 * the single place that decides, shared by the verify cron and the button on
 * the article page, so the two cannot disagree.
 */
export async function verifyPublishingArticle(articleId: string): Promise<VerifyResult> {
  const { createClient } = await import('@/lib/supabase/service')
  const supabase = createClient()

  const { data, error } = await supabase
    .from('seo_articles')
    .select('id, status, published_url, publish_ref, publishing_since')
    .eq('id', articleId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const article = data as Pick<
    SeoArticle,
    'id' | 'status' | 'published_url' | 'publish_ref' | 'publishing_since'
  > | null
  if (!article) throw new Error('Article not found')
  if (article.status !== 'publishing') {
    return { articleId, outcome: 'waiting', detail: `Not publishing (status ${article.status})` }
  }

  const prUrl = article.publish_ref
  const url = article.published_url
  if (!url) return { articleId, outcome: 'blocked', detail: 'No published_url to verify' }

  // 1. The PR must be merged — and if its build failed, say so instead of waiting.
  if (prUrl?.startsWith('http')) {
    const token = process.env.GITHUB_PUBLISH_TOKEN
    if (!token) return { articleId, outcome: 'waiting', detail: 'GITHUB_PUBLISH_TOKEN is not configured' }
    const { owner, repo, number } = parsePrUrl(prUrl)
    const pr = await gh<{ merged: boolean; state: string }>(token, `/repos/${owner}/${repo}/pulls/${number}`)
    if (!pr.merged) {
      const checks = await prChecks(prUrl)
      const detail =
        checks.state === 'failure'
          ? `Build failed on the open pull request (${checks.failures
              .map((f) => (f.url ? `${f.context} — ${f.url}` : f.context))
              .join('; ')}). Fix it, then publish again.`
          : `Pull request still open (${prUrl}), checks ${checks.state}.`
      if (checks.state === 'failure') {
        await supabase.from('seo_articles').update({ publish_error: detail }).eq('id', articleId)
        return { articleId, outcome: 'blocked', detail }
      }
      return { articleId, outcome: 'waiting', detail }
    }
  }

  // 2. Merged — now the URL has to answer. A site deploy takes a minute or two,
  //    so "not yet" is normal and just means check again next tick.
  const { live, status } = await publishedUrlIsLive(url)
  if (live) {
    const { error: upErr } = await supabase
      .from('seo_articles')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        publish_error: null,
        publishing_since: null,
      })
      .eq('id', articleId)
    if (upErr) throw new Error(upErr.message)
    return { articleId, outcome: 'published', detail: `${url} returned 200` }
  }

  const since = article.publishing_since ? new Date(article.publishing_since).getTime() : Date.now()
  if (Date.now() - since > PUBLISH_VERIFY_GIVE_UP_MS) {
    const detail = `Merged, but ${url} has not returned 200 in 6 hours (last status ${status || 'unreachable'}). Check the site deploy.`
    await supabase.from('seo_articles').update({ publish_error: detail }).eq('id', articleId)
    return { articleId, outcome: 'gave_up', detail }
  }

  return {
    articleId,
    outcome: 'waiting',
    detail: `Merged; waiting for ${url} to answer (last status ${status || 'unreachable'})`,
  }
}

/** Sweep every article stuck in 'publishing'. Driven by the verify cron. */
export async function verifyPublishingArticles(): Promise<VerifyResult[]> {
  const { createClient } = await import('@/lib/supabase/service')
  const supabase = createClient()
  const { data, error } = await supabase
    .from('seo_articles')
    .select('id')
    .eq('status', 'publishing')
    .order('publishing_since', { ascending: true })
    .limit(25)
  if (error) throw new Error(error.message)

  const results: VerifyResult[] = []
  for (const row of (data ?? []) as Array<{ id: string }>) {
    try {
      results.push(await verifyPublishingArticle(row.id))
    } catch (err) {
      results.push({
        articleId: row.id,
        outcome: 'blocked',
        detail: err instanceof Error ? err.message : 'Verification failed',
      })
    }
  }
  return results
}
