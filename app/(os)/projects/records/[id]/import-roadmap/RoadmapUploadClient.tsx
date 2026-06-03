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
    <div style={{ maxWidth: 560 }}>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
        Upload a roadmap document (.docx or .md, max 15MB). We’ll extract a structured task list for you to review before anything is created.
      </p>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
          className="filter-select"
          style={{ width: '100%' }}
        />
        {fileName ? <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{fileName}</p> : null}
        {error ? <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p> : null}
        <div style={{ textAlign: 'right' }}>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
            {busy ? 'Extracting… (this can take ~20s)' : 'Extract tasks'}
          </button>
        </div>
      </div>
    </div>
  )
}
