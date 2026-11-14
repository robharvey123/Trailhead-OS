'use client'

import { useRef, useState } from 'react'
import MentionPicker, { type MentionCandidate } from './MentionPicker'

const MAX_FILES = 4
const MAX_BYTES = 25 * 1024 * 1024
const MENTION_LIMIT = 8
const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
])

function fmtBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * The active @mention token immediately before the caret: a `@` at the start or
 * after whitespace, followed by non-whitespace, non-`@` chars up to the caret.
 * Returns the `@` index and the typed query, or null when not in a mention.
 */
function activeMention(value: string, caret: number): { start: number; query: string } | null {
  const at = value.lastIndexOf('@', caret - 1)
  if (at === -1) return null
  if (at > 0 && !/\s/.test(value[at - 1])) return null
  const between = value.slice(at + 1, caret)
  if (/[\s@]/.test(between)) return null
  return { start: at, query: between }
}

export default function MessageComposer({
  onSend,
  onTyping,
  disabled,
  people = [],
}: {
  onSend: (body: string, files: File[], mentionPersonIds: string[]) => void
  onTyping?: () => void
  disabled?: boolean
  people?: MentionCandidate[]
}) {
  const [value, setValue] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // @mention state
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<MentionCandidate[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  // People explicitly picked from the dropdown (id → full_name). On send we keep
  // only those whose `@{full_name}` text still survives in the body.
  const pickedRef = useRef<Map<string, string>>(new Map())
  const pickerOpen = mentionStart !== null && candidates.length > 0

  function refreshMention(el: HTMLTextAreaElement) {
    if (people.length === 0) return
    const token = activeMention(el.value, el.selectionStart ?? el.value.length)
    if (!token) {
      setMentionStart(null)
      setCandidates([])
      return
    }
    const q = token.query.toLowerCase()
    const matches = people.filter((p) => p.full_name.toLowerCase().startsWith(q)).slice(0, MENTION_LIMIT)
    setMentionStart(matches.length ? token.start : null)
    setCandidates(matches)
    setActiveIndex(0)
  }

  function closeMention() {
    setMentionStart(null)
    setCandidates([])
  }

  function selectMention(person: MentionCandidate) {
    const el = textareaRef.current
    if (el === null || mentionStart === null) return
    const caret = el.selectionStart ?? value.length
    const before = value.slice(0, mentionStart)
    const after = value.slice(caret)
    const insert = `@${person.full_name} `
    const next = before + insert + after
    pickedRef.current.set(person.id, person.full_name)
    setValue(next)
    closeMention()
    // Restore caret after the inserted token.
    const pos = before.length + insert.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list)
    setError('')
    const accepted: File[] = []
    for (const f of incoming) {
      if (!ALLOWED.has(f.type)) { setError(`“${f.name}” is not an allowed file type.`); continue }
      if (f.size > MAX_BYTES) { setError(`“${f.name}” is over 25 MB.`); continue }
      accepted.push(f)
    }
    setFiles((cur) => {
      const merged = [...cur, ...accepted]
      if (merged.length > MAX_FILES) {
        setError(`Up to ${MAX_FILES} files per message.`)
        return merged.slice(0, MAX_FILES)
      }
      return merged
    })
  }

  function submit() {
    const v = value.trim()
    if ((!v && files.length === 0) || disabled) return
    // Keep only mentions whose token text still appears in the body.
    const mentionIds = [...pickedRef.current.entries()]
      .filter(([, name]) => value.includes(`@${name}`))
      .map(([id]) => id)
    onSend(v, files, mentionIds)
    setValue('')
    setFiles([])
    setError('')
    pickedRef.current.clear()
    closeMention()
  }

  function onTextKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (pickerOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % candidates.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i - 1 + candidates.length) % candidates.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(candidates[activeIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); closeMention(); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div className="border-t border-[var(--border)]">
      {files.length ? (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-2)]">
              📎 {f.name} <span className="text-[var(--text-3)]">{fmtBytes(f.size)}</span>
              <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="cursor-pointer border-none bg-transparent text-[var(--text-3)]">✕</button>
            </span>
          ))}
        </div>
      ) : null}
      {error ? <p className="m-0 px-3 pt-1.5 text-xs text-[var(--red-strong)]">{error}</p> : null}

      <div
        className={`relative flex items-end gap-2 p-3 ${dragOver ? 'outline-2 -outline-offset-4 outline-dashed outline-[var(--accent-strong)]' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files) }}
      >
        {pickerOpen ? (
          <MentionPicker items={candidates} activeIndex={activeIndex} onSelect={selectMention} onHover={setActiveIndex} />
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm flex-none" onClick={() => inputRef.current?.click()} disabled={disabled} aria-label="Attach files">📎</button>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
        <textarea
          ref={textareaRef}
          className="w-full rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none max-h-[140px]"
          value={value}
          rows={1}
          placeholder="Write a message…   (@ to mention)"
          onChange={(e) => { setValue(e.target.value); onTyping?.(); refreshMention(e.target) }}
          onKeyUp={(e) => refreshMention(e.currentTarget)}
          onClick={(e) => refreshMention(e.currentTarget)}
          onBlur={() => closeMention()}
          onKeyDown={onTextKeyDown}
        />
        <button className="btn btn-primary btn-sm flex-none" onClick={submit} disabled={disabled || (!value.trim() && files.length === 0)}>Send</button>
      </div>
    </div>
  )
}
