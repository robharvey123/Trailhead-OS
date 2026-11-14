'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { extractRoadmapImport } from './actions'

export default function RoadmapUploadClient({ projectId }: { projectId: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const file = inputRef.current?.files?.[0]
    if (!file) { setError('Choose a .docx or .md file first.'); return }
    setBusy(true); setError('')
    const fd = new FormData()
    fd.set('file', file)
    const res = await extractRoadmapImport(projectId, fd)
    if (res.error) { setError(res.error); setBusy(false); return }
    router.push(`/projects/records/${projectId}/import-roadmap?import_id=${res.importId}`)
  }

  return (
    <div className="max-w-[560px]">
      <p className="mb-3.5 text-[13px] text-[var(--text-2)]">
        Upload a roadmap document (.docx or .md, max 15MB). We’ll extract a structured task list for you to review before anything is created.
      </p>
      <div className="card grid gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
          className="filter-select w-full"
        />
        {fileName ? <p className="text-xs text-[var(--text-3)]">{fileName}</p> : null}
        {error ? <p className="text-xs text-[var(--red)]">{error}</p> : null}
        <div className="text-right">
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
            {busy ? 'Extracting… (this can take ~20s)' : 'Extract tasks'}
          </button>
        </div>
      </div>
    </div>
  )
}
