'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  id?: string
  style?: CSSProperties
}

export default function Reveal({
  children,
  className = '',
  id,
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current

    if (!element || visible) {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      const frame = window.requestAnimationFrame(() => setVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        })
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -40px 0px',
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [visible])

  return (
    <section
      ref={ref}
      id={id}
      style={style}
      className={`marketing-reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
    >
      {children}
    </section>
  )
}
