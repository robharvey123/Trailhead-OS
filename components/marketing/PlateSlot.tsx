import Image from 'next/image'

/**
 * A plate: the slot where a real photograph or product screenshot mounts.
 *
 * The site ships imagery-free because the real assets were not on disk, and it
 * fakes nothing in the meantime — no grey box, no gradient, no device mockup
 * standing in for a screenshot. Without a `src` this renders nothing at all, so
 * the live site never shows a placeholder to a visitor.
 *
 * To fill one: drop the file into `public/`, then pass its path. Sizes and
 * destinations are listed in `.impeccable/ASSETS.md`.
 */
export default function PlateSlot({
  src,
  alt,
  caption,
  width,
  height,
  className = '',
  priority = false,
}: {
  /** Omit until the real asset exists. Never point this at stock or a mockup. */
  src?: string
  alt: string
  caption?: string
  width: number
  height: number
  className?: string
  priority?: boolean
}) {
  if (!src) return null

  return (
    <figure className={className}>
      <div className="border border-[var(--ink)] bg-[var(--card)]">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className="block h-auto w-full"
        />
      </div>
      {caption ? (
        <figcaption className="plan-data mt-2 text-[var(--ink-3)]">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
