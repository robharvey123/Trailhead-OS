// app/sitemap.ts
// Served at /sitemap.xml automatically. Add new static routes to STATIC_ROUTES.
// Wire getAllPosts() to your blog loader for dynamic post URLs.

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
// import { getAllPosts } from "@/lib/posts";

const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/",            changeFrequency: "weekly",  priority: 1.0 },
  { path: "/bright-fire", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact",     changeFrequency: "yearly",  priority: 0.6 },
  { path: "/blog",        changeFrequency: "weekly",  priority: 0.9 },
  // Add new pages here as you build them out (e.g. /services/ngp-consulting)
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Dynamic blog posts. Uncomment once your loader is wired up.
  // const posts = await getAllPosts();
  // const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
  //   url: `${SITE_URL}/blog/${p.slug}`,
  //   lastModified: new Date(p.updatedAt ?? p.publishedAt),
  //   changeFrequency: "monthly",
  //   priority: 0.7,
  // }));
  const postEntries: MetadataRoute.Sitemap = [];

  return [...staticEntries, ...postEntries];
}
