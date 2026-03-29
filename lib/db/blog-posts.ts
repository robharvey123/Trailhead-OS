import { createClient } from '@/lib/supabase/server'
import type { BlogPost, BlogPostInput } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function getPublishedBlogPosts(
  options: {
    tag?: string | null
    limit?: number
  } = {},
  client?: SupabaseClient
): Promise<BlogPost[]> {
  const supabase = await getSupabase(client)
  let query = supabase.from('blog_posts').select('*').eq('published', true)

  if (options.tag) {
    query = query.contains('tags', [options.tag])
  }

  query = query
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load blog posts')
  }

  return (data ?? []) as BlogPost[]
}

export async function getAllBlogPosts(
  client?: SupabaseClient
): Promise<BlogPost[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('published', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Failed to load blog posts')
  }

  return (data ?? []) as BlogPost[]
}

export async function getPublishedBlogPostBySlug(
  slug: string,
  client?: SupabaseClient
): Promise<BlogPost | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load blog post')
  }

  return (data as BlogPost | null) ?? null
}

export async function getBlogPostById(
  id: string,
  client?: SupabaseClient
): Promise<BlogPost | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load blog post')
  }

  return (data as BlogPost | null) ?? null
}

export async function createBlogPost(
  input: BlogPostInput,
  client?: SupabaseClient
): Promise<BlogPost> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt ?? null,
      body: input.body,
      published: Boolean(input.published),
      published_at: input.published_at ?? null,
      tags: input.tags ?? [],
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create blog post')
  }

  return data as BlogPost
}

export async function updateBlogPost(
  id: string,
  input: Partial<BlogPostInput>,
  client?: SupabaseClient
): Promise<BlogPost> {
  const supabase = await getSupabase(client)
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.title !== undefined) patch.title = input.title
  if (input.slug !== undefined) patch.slug = input.slug
  if (input.excerpt !== undefined) patch.excerpt = input.excerpt ?? null
  if (input.body !== undefined) patch.body = input.body
  if (input.published !== undefined) patch.published = input.published
  if (input.published_at !== undefined) patch.published_at = input.published_at
  if (input.tags !== undefined) patch.tags = input.tags

  const { data, error } = await supabase
    .from('blog_posts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update blog post')
  }

  return data as BlogPost
}

export async function deleteBlogPost(id: string, client?: SupabaseClient) {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete blog post')
  }
}
