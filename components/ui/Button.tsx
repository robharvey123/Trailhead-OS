import Link from 'next/link'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * The one button in Trailhead OS.
 *
 * - `primary`: brand-blue pill with navy type. At most one per screen region.
 * - `secondary`: white pill with a 1px border and navy type.
 * - `ghost`: text only.
 * - `danger`: red type and border on white. `danger-solid` (filled red) is for
 *   the confirming action inside a confirm dialog and nowhere else.
 *
 * Pass `href` to render a Next `<Link>`; otherwise it renders a `<button>`.
 * The look lives in `app/globals.css` (`.btn*`) so this component and the
 * class names written in older call sites can never drift apart.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid'
export type ButtonSize = 'sm' | 'md'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-text',
  danger: 'btn-danger',
  'danger-solid': 'btn-danger-solid',
}

/** The class string, for the rare element that cannot be a Button (a `<label>` file picker, a `<summary>`). */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return ['btn', VARIANT_CLASS[variant], size === 'sm' ? 'btn-sm' : '', className ?? ''].filter(Boolean).join(' ')
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<'button'>, keyof CommonProps | 'href'> & { href?: undefined }

type ButtonAsLink = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof CommonProps> & { href: string }

export type ButtonProps = ButtonAsButton | ButtonAsLink

export default function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant = 'secondary', size = 'md', className, children, ...rest } = props
    return (
      <Link className={buttonClass(variant, size, className)} {...rest}>
        {children}
      </Link>
    )
  }

  const { variant = 'secondary', size = 'md', className, children, type = 'button', ...rest } = props
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  )
}
