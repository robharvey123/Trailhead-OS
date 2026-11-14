import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * A white card on the cool-light page ground: 14px radius, hairline border,
 * the resting shadow. `tone="muted"` is the cool-light variant for a card
 * nested inside a white one.
 */
interface CardProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  /** Label-style heading shown at the top of the card. */
  title?: ReactNode
  /** Controls shown opposite the title. */
  actions?: ReactNode
  tone?: 'default' | 'muted'
  /** Remove the default padding, for a card that holds a table or a list. */
  flush?: boolean
  children: ReactNode
}

export default function Card({
  title,
  actions,
  tone = 'default',
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  const surface = tone === 'muted' ? 'os-card-muted' : 'os-card'
  return (
    <div className={`${surface} ${flush ? '' : 'p-5'} ${className ?? ''}`} {...rest}>
      {title || actions ? (
        <div className={`flex items-center justify-between gap-3 ${flush ? 'px-5 pt-5' : ''} mb-3`}>
          {title ? <h2 className="os-label">{title}</h2> : <span />}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
