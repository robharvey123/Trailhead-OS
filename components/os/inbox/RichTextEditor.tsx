'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'

/**
 * Headless TipTap rich-text editor for ComposeModal. Client-only
 * (immediatelyRender: false) so Next doesn't hydration-mismatch. Emits HTML into
 * the existing body_html send path. Toolbar uses the app's .btn classes.
 */
export default function RichTextEditor({
  initialHTML,
  onChange,
}: {
  initialHTML: string
  onChange: (html: string) => void
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // StarterKit (v2) provides bold/italic/lists/quote; Link + Underline are
      // separate extensions added explicitly.
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: initialHTML || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) {
    return <div className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)]" style={{ minHeight: 220 }} />
  }

  const cls = (active: boolean) => `btn btn-ghost btn-sm ${active ? 'active' : ''}`
  function setLink() {
    const ed = editor!
    const prev = ed.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev || 'https://')
    if (url === null) return
    if (url.trim() === '') { ed.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    ed.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)]">
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] p-1">
        <button type="button" className={cls(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><b>B</b></button>
        <button type="button" className={cls(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><i>I</i></button>
        <button type="button" className={cls(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><u>U</u></button>
        <button type="button" className={cls(editor.isActive('link'))} onClick={setLink} title="Link">🔗</button>
        <button type="button" className={cls(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bulleted list">• List</button>
        <button type="button" className={cls(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">1. List</button>
        <button type="button" className={cls(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">❝</button>
      </div>
      <EditorContent editor={editor} className="tiptap-body px-3 py-2 text-sm text-[var(--text)]" />
    </div>
  )
}
