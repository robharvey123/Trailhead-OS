'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Everything the browser will hand focus to via Tab. Kept in one place so the
 * trap and the "focus the first control on open" pass agree on what counts.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    // offsetParent is null for display:none subtrees; position:fixed nodes keep
    // a null offsetParent too, hence the client-rect fallback.
    (node) => node.offsetParent !== null || node.getClientRects().length > 0
  )
}

/**
 * Open dialogs, innermost last. Only the top of the stack answers Escape and
 * traps Tab, so a modal opened on top of another (ComposeModal's "add these
 * recipients?" step) doesn't dismiss its parent along with itself.
 */
const modalStack: symbol[] = []

/** Nested modals share one body scroll lock; the last one out restores it. */
let scrollLockCount = 0

interface ModalProps {
  open: boolean
  /** Fired by Escape, the backdrop button, and anything the panel wires to it. */
  onClose: () => void
  /**
   * Accessible name for the dialog. Rendered into a hidden element that
   * `aria-labelledby` points at, so the panel keeps whatever visible heading it
   * already had instead of growing a duplicate one.
   */
  title: string
  /** 'center' centres the panel; 'right' docks it as a full-height slide-over. */
  placement?: 'center' | 'right'
  /** Accessible name for the click-outside backdrop button. */
  closeLabel?: string
  /** Extra classes on the fixed overlay (z-index, padding). */
  overlayClassName?: string
  /** Classes on the dialog panel itself. */
  panelClassName?: string
  children: ReactNode
}

/**
 * The one overlay primitive: focus trap, Escape to close, restore-focus-on-close,
 * body scroll lock, and a backdrop that is a real button rather than a div with
 * an onClick. `thmock` is on the overlay because this portals to document.body,
 * OUTSIDE the app's .thmock wrapper where the design tokens live.
 *
 * `components/os/ConfirmDialog.tsx` intentionally stays on its own
 * `role="alertdialog"` implementation — destructive confirmations want the
 * stronger role and its own focus defaults.
 */
export default function Modal({
  open,
  onClose,
  title,
  placement = 'center',
  closeLabel = 'Close dialog',
  overlayClassName = '',
  panelClassName = '',
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Consumers pass inline arrows, so onClose changes identity every render.
  // Reading it through a ref keeps the focus effect keyed on `open` alone —
  // otherwise every keystroke inside the panel would yank focus back to the top.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = focusableWithin(panel)[0]
    ;(first ?? panel)?.focus()

    const id = Symbol('modal')
    modalStack.push(id)

    function handleKeyDown(event: KeyboardEvent) {
      // Only the innermost open dialog owns the keyboard.
      if (modalStack[modalStack.length - 1] !== id) return

      // Dialogs this primitive doesn't own can still stack on top of it —
      // components/os/ConfirmDialog does exactly that on the deal delete flow.
      // While focus sits inside one, stand down completely, or the trap would
      // pull focus back out of the confirmation and Escape would close the
      // wrong layer.
      const focused = document.activeElement
      if (focused instanceof Element) {
        const owningDialog = focused.closest('[role="dialog"],[role="alertdialog"]')
        if (owningDialog && owningDialog !== panelRef.current) return
      }

      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const nodes = focusableWithin(panelRef.current)
      if (nodes.length === 0) {
        event.preventDefault()
        panelRef.current?.focus()
        return
      }

      const firstNode = nodes[0]
      const lastNode = nodes[nodes.length - 1]
      const active = document.activeElement
      const inside = panelRef.current?.contains(active) ?? false

      if (event.shiftKey) {
        if (!inside || active === firstNode) {
          event.preventDefault()
          lastNode.focus()
        }
      } else if (!inside || active === lastNode) {
        event.preventDefault()
        firstNode.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      const index = modalStack.indexOf(id)
      if (index >= 0) modalStack.splice(index, 1)
      // Hand focus back to whatever opened the dialog.
      previouslyFocused?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    scrollLockCount += 1
    document.body.style.overflow = 'hidden'
    return () => {
      scrollLockCount -= 1
      if (scrollLockCount === 0) document.body.style.overflow = ''
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`thmock fixed inset-0 z-50 flex ${
        placement === 'right' ? 'justify-end' : 'items-center justify-center'
      } bg-[rgba(15,23,42,0.45)] ${overlayClassName}`}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className={placement === 'right' ? 'flex-1 cursor-default' : 'absolute inset-0 cursor-default'}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        // focus:outline-none only suppresses the ring from the programmatic
        // focus this component performs on open; :focus-visible on the controls
        // inside is untouched.
        className={`relative focus:outline-none ${panelClassName}`}
      >
        {/* display:none is still a valid aria-labelledby target — the name is
            computed from its text without adding a second visible heading. */}
        <span id={titleId} className="hidden">
          {title}
        </span>
        {children}
      </div>
    </div>,
    document.body
  )
}
