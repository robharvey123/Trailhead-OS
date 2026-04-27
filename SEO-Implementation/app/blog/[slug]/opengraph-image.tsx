// app/blog/[slug]/opengraph-image.tsx
// Per-post OG image. Pulls the post title from your loader.
// Wire getPost() to your existing blog loader.

import { ImageResponse } from "next/og";
// import { getPost } from "@/lib/posts";

export const runtime = "edge";
export const alt = "Trailhead Holdings blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: { slug: string } };

export default async function PostOgImage({ params }: Props) {
  // const post = await getPost(params.slug);
  // const title = post?.title ?? "Trailhead Holdings";
  const title = "Trailhead Holdings"; // replace with the line above once getPost is wired up

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #0b1220 0%, #1a2840 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.7, letterSpacing: 2, textTransform: "uppercase" }}>
          Trailhead Holdings, blog
        </div>
        <div
          style={{
            fontSize: title.length > 60 ? 56 : 72,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 24, opacity: 0.7 }}>trailheadholdings.uk/blog</div>
      </div>
    ),
    { ...size }
  );
}
