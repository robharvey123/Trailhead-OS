# VS Code agent prompt, paste this into your agent of choice

---

You are working inside the Next.js (App Router) repo for **www.trailheadholdings.uk**, deployed on Vercel. The site has near-zero SEO right now: every page returns the same `<title>` and meta description, no Open Graph tags, no canonical, no JSON-LD, no sitemap, no robots.txt, no llms.txt. Pages are server-rendered, so this is purely a metadata and config job.

I have prepared drop-in code in a separate folder. Your job is to integrate it into this repo cleanly.

## Source of the prepared code

The prepared files live at:

```
/Users/rob/Documents/Claude/Projects/Trailhead OS/SEO-Implementation/
```

Start by reading every file in that folder, including `README.md`. The README is the spec. Files ending in `.snippet` are fragments to merge into existing files in this repo, not standalone files. Files ending in `.ts` or `.tsx` (without `.snippet`) can be copied straight in.

The repo uses the `@/` path alias for the project root. Confirm this in `tsconfig.json` and adjust imports if it differs.

## What to do, in order

1. **Inventory the existing repo.** Identify:
   - Where `app/layout.tsx`, `app/page.tsx`, `app/contact/page.tsx`, `app/bright-fire/page.tsx`, `app/blog/page.tsx`, `app/blog/[slug]/page.tsx` currently live and what they export.
   - How blog posts are loaded today (MDX? contentlayer? fs reads of markdown? a CMS? something else). Look for files like `lib/posts.ts`, `content/`, `posts/`, `.mdx` files, or imports from a CMS SDK.
   - Whether `vercel.json` already exists at the repo root.
   - The current `tsconfig.json` path alias.

2. **Copy in the standalone files** from the prepared folder:
   - `lib/seo.ts`
   - `components/JsonLd.tsx`
   - `app/robots.ts`
   - `app/sitemap.ts`
   - `app/llms.txt/route.ts`
   - `app/opengraph-image.tsx`
   - `app/blog/[slug]/opengraph-image.tsx`
   - `vercel.json` (if one already exists, merge rather than overwrite, ask me before overwriting)

3. **Merge the `.snippet` files** into the matching existing pages:
   - `app/layout.tsx`: replace the `metadata` export with the version in `layout.tsx.snippet`, add the `OrganizationJsonLd` and `WebSiteJsonLd` imports and tags inside `<body>`. Preserve all existing imports, providers, fonts, and the existing JSX structure.
   - `app/page.tsx`: add the `metadata` export at the top, leave the default-exported component alone.
   - `app/bright-fire/page.tsx`: same.
   - `app/contact/page.tsx`: same.
   - `app/blog/page.tsx`: same.
   - `app/blog/[slug]/page.tsx`: replace any existing `generateMetadata` with the version from the snippet, add the `BlogPostingJsonLd` tag inside the rendered article. Wire `getPost`/`getAllPosts` to whatever loader the repo currently uses (do not invent a new one, find and reuse).

4. **Wire the blog loader.** The prepared `app/sitemap.ts`, `app/blog/[slug]/page.tsx`, and `app/blog/[slug]/opengraph-image.tsx` all have commented-out imports like `import { getAllPosts } from "@/lib/posts"`. Find the actual loader in this repo and replace the stubs with real calls. The expected post shape is:
   ```ts
   { title, description, slug, publishedAt, updatedAt?, author?, ogImage?, tags? }
   ```
   If the existing loader returns a different shape, write a small adapter rather than changing the loader's contract.

5. **Verify the build.** Run `pnpm build` (or `npm run build` / `yarn build`, whichever this repo uses). Fix any TypeScript errors. The build must succeed before you stop.

6. **Smoke-test locally.** Run `pnpm dev`, then in a second terminal verify the following return non-empty content:
   - `curl -s http://localhost:3000/robots.txt`
   - `curl -s http://localhost:3000/sitemap.xml`
   - `curl -s http://localhost:3000/llms.txt`
   - `curl -sI http://localhost:3000/opengraph-image.png` (should be `image/png`)
   - `curl -s http://localhost:3000/ | grep -E "<title>|application/ld\+json|og:title"` (should show unique title, two JSON-LD blocks, OG tags)
   - `curl -s http://localhost:3000/blog/<an-existing-slug> | grep -E "BlogPosting|og:title"`

7. **Report back** with:
   - List of files created
   - List of files modified (with one-line summary of the change)
   - The blog loader you wired up and whether you needed an adapter
   - Output of the smoke tests
   - Any open questions or assumptions you made

## Things to ask me before doing

- If `vercel.json` already exists with conflicting redirects or headers, show me the diff before merging.
- If you cannot find a blog loader (no MDX, no markdown, no CMS), stop and ask.
- If the existing `app/layout.tsx` uses Pages Router (`pages/_app.tsx`), stop. The prepared code is App Router only.
- If `tsconfig.json` does not have the `@/` alias, ask before adding it (or change the imports to relative paths).

## Things to NOT do

- Do not change any visible UI, copy, or component logic. This is purely SEO/metadata work.
- Do not add new dependencies unless strictly required (the prepared code uses only Next.js built-ins, no new packages should be needed).
- Do not edit anything in `_Admin/` folders.
- Do not commit a Twitter handle, GSC verification token, or Bing token. Those values are placeholders in `lib/seo.ts` and the layout snippet, leave them as comments and flag them in your report so I can fill them in.
- Do not push or open a PR, just stage the changes locally and report.

## Definition of done

- All files from the prepared folder are integrated.
- `pnpm build` succeeds with no TypeScript errors.
- All seven smoke tests pass.
- Final report posted with files changed, loader wiring, smoke test output, and open questions.
