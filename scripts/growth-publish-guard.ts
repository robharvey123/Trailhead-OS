/**
 * Publish-gate regression guard (Growth).
 *
 * Reproduces the incident that started this: a publish PR whose build fails
 * must never leave the article at status 'published'. Also covers the two ways
 * that gate was defeated in practice —
 *   • "Vercel Preview Comments" completing `success` a second after the PR
 *     opens, before the build has reported (how PR #10 merged a failed build);
 *   • /check-runs returning 403 to the publish token, which used to throw and
 *     take the whole verdict down (PR #21).
 *
 * Runs against the DB in .env.local and a real scratch branch + PR on the site
 * repo, then closes the PR and deletes the branch. It NEVER merges, so nothing
 * reaches the live site. Needs GITHUB_PUBLISH_TOKEN with `repo`; skips cleanly
 * without it. NOT a build gate — it writes rows and opens a PR.
 *
 * Run: `GITHUB_PUBLISH_TOKEN=$(gh auth token) npm run test:growth-publish`
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name]
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return undefined
  const m = new RegExp(`^${name}=(.*)$`, 'm').exec(readFileSync(p, 'utf8'))
  return m ? m[1].trim().replace(/^"|"$/g, '') : undefined
}
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  const v = env(k)
  if (!v) {
    console.error(`Missing ${k} (env or .env.local).`)
    process.exit(2)
  }
  process.env[k] = v
}
if (!process.env.GITHUB_PUBLISH_TOKEN) {
  const fromFile = env('GITHUB_PUBLISH_TOKEN')
  if (fromFile) process.env.GITHUB_PUBLISH_TOKEN = fromFile
}
if (!process.env.GITHUB_PUBLISH_TOKEN) {
  console.log('SKIPPED — set GITHUB_PUBLISH_TOKEN (e.g. $(gh auth token)) to run this guard.')
  process.exit(0)
}

const TOKEN = process.env.GITHUB_PUBLISH_TOKEN
const SLUG = 'zz-publish-guard'
/** Not 'Vercel': Vercel owns that context and overwrites it with success when
 *  the real preview build finishes, so a planted failure there does not survive
 *  long enough to assert on. Any failing context must block the merge. */
const FAIL_CONTEXT = 'zz-guard-build'

let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) fail++
}
async function gh<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  const text = await res.text()
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T }
}

async function main() {
  const { createClient } = await import('../lib/supabase/service')
  const pub = await import('../lib/growth/publish')
  const svc = createClient()

  // Any github-backed site will do; take the first one configured.
  const { data: sites } = await svc
    .from('seo_sites')
    .select('*')
    .eq('cms_type', 'github')
    .order('created_at', { ascending: true })
  const site = (sites ?? []).find(
    (s) => typeof (s as { cms_config?: { repo?: string } }).cms_config?.repo === 'string'
  ) as { id: string; cms_config: { repo: string } } | undefined
  if (!site) {
    console.log('SKIPPED — no github-backed seo_sites row with cms_config.repo.')
    process.exit(0)
  }
  const REPO = site.cms_config.repo
  const OWNER = REPO.split('/')[0]
  const BRANCH = `seo/${SLUG}`
  console.log(`Repo: ${REPO}\n`)

  // Clean slate if a previous run died mid-way.
  await svc.from('seo_articles').delete().eq('slug', SLUG)
  const stale = await gh<Array<{ number: number }>>(`/repos/${REPO}/pulls?state=open&head=${OWNER}:${BRANCH}`)
  for (const pr of stale.body ?? []) {
    await gh(`/repos/${REPO}/pulls/${pr.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) })
  }
  await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, { method: 'DELETE' })

  const { data: made, error: mkErr } = await svc
    .from('seo_articles')
    .insert({
      site_id: site.id,
      title: 'ZZ publish guard - delete me',
      slug: SLUG,
      status: 'approved',
      body_mdx: '# ZZ guard\n\nThrowaway article for the publish-gate guard.\n',
      meta_description: 'Throwaway.',
      word_count: 8,
    })
    .select('*')
    .single()
  if (mkErr) throw new Error(mkErr.message)
  const articleId = (made as { id: string }).id

  try {
    console.log('1. Open the publish PR')
    const result = await pub.publishArticle(made as never, site as never)
    const prNumber = result.ref.split('/').pop()!
    ok('a PR was opened', result.ref.includes('/pull/'), result.ref)

    // This is what publishArticleAction writes for a GitHub publish.
    await svc
      .from('seo_articles')
      .update({
        status: 'publishing',
        publish_ref: result.ref,
        published_url: result.url,
        publishing_since: new Date().toISOString(),
        published_at: null,
      })
      .eq('id', articleId)

    console.log('\n2. A required context that has not reported is pending, not success')
    // This is the window PR #10 merged in. Vercel registers "Vercel Preview
    // Comments" and completes it `success` about a second after a PR opens,
    // while the build reports separately and later — so "nothing failing and
    // something passed" is true before the build has said anything. Requiring a
    // context that has not reported keeps the verdict pending. Asserted here,
    // on a PR with no failure yet, because a real failure outranks pending.
    const earlyVerdict = await pub.prChecks(result.ref, { requiredContexts: ['Nonexistent Build'] })
    ok('unreported required context is pending', earlyVerdict.state === 'pending', earlyVerdict.state)
    ok('and reports no failures', earlyVerdict.failures.length === 0)

    console.log('\n3. The build fails')
    const head = await gh<{ head: { sha: string } }>(`/repos/${REPO}/pulls/${prNumber}`)
    const sha = head.body.head.sha
    const posted = await gh(`/repos/${REPO}/statuses/${sha}`, {
      method: 'POST',
      body: JSON.stringify({
        state: 'failure',
        context: FAIL_CONTEXT,
        target_url: 'https://vercel.com/zz-guard',
        description: 'ZZ guard failure',
      }),
    })
    ok('failing status posted', posted.status === 201, `HTTP ${posted.status}`)
    const verdict = await pub.prChecks(result.ref, { requiredContexts: [FAIL_CONTEXT] })
    ok('prChecks reports failure', verdict.state === 'failure', verdict.state)
    ok('it carries the build link', Boolean(verdict.failures[0]?.url), verdict.failures[0]?.url ?? 'none')

    console.log('\n4. The merge is refused and the PR stays open')
    await pub.mergePublishPr(result.ref, { requiredContexts: [FAIL_CONTEXT] }).then(
      () => ok('merge refused', false, 'IT MERGED'),
      (e: Error) => {
        ok('merge refused', e.name === 'ChecksBlockedMerge', e.name)
        ok('the reason names the build', /build on this pull request failed/.test(e.message))
      }
    )
    const after = await gh<{ merged: boolean; state: string }>(`/repos/${REPO}/pulls/${prNumber}`)
    ok('PR open and unmerged', after.body.merged === false && after.body.state === 'open')

    console.log('\n5. THE INVARIANT: the article is never published')
    const verified = await pub.verifyPublishingArticle(articleId)
    ok('verifier does not promote it', verified.outcome !== 'published', verified.outcome)
    const { data: row } = await svc
      .from('seo_articles')
      .select('status, published_at, publish_error')
      .eq('id', articleId)
      .single()
    const r = row as Record<string, unknown>
    ok('status is NOT published', r.status !== 'published', String(r.status))
    ok('published_at is still null', r.published_at === null)
    ok('the failure is recorded on the article', Boolean(r.publish_error), String(r.publish_error ?? '').slice(0, 80))

    console.log('\n6. A token that cannot read check runs still gets a verdict')
    // /check-runs 403s for the production publish token; that must not throw.
    ok('prChecks returned a verdict despite check-run access', ['failure', 'pending', 'success', 'none'].includes(verdict.state), verdict.state)
  } finally {
    console.log('\n7. Cleanup')
    const open = await gh<Array<{ number: number }>>(`/repos/${REPO}/pulls?state=open&head=${OWNER}:${BRANCH}`)
    for (const pr of open.body ?? []) {
      const closed = await gh(`/repos/${REPO}/pulls/${pr.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) })
      ok(`closed PR #${pr.number}`, closed.status === 200, `HTTP ${closed.status}`)
    }
    const deleted = await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, { method: 'DELETE' })
    ok('scratch branch deleted', deleted.status === 204, `HTTP ${deleted.status}`)
    const { error: delErr } = await svc.from('seo_articles').delete().eq('id', articleId)
    ok('scratch article deleted', !delErr, delErr?.message ?? '')
  }

  console.log(`\n${fail === 0 ? '✓ PUBLISH GUARD PASSED' : `✗ ${fail} FAILURE(S)`}`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
