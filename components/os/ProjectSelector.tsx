'use client'

import type { ProjectListItem } from '@/lib/types'
import SearchSelect from './SearchSelect'

export default function ProjectSelector({
  label,
  value,
  projects,
  onChange,
  emptyLabel = 'No project',
  disabled = false,
}: {
  label: string
  value: string
  projects: ProjectListItem[]
  onChange: (value: string) => void
  emptyLabel?: string
  disabled?: boolean
}) {
  return (
    <SearchSelect
      label={label}
      value={value}
      options={projects.map((project) => ({
        value: project.id,
        label: project.name,
        meta: project.account?.name ?? project.workstream?.label ?? null,
      }))}
      onChange={onChange}
      placeholder="Search projects"
      emptyLabel={emptyLabel}
      disabled={disabled}
      maxVisibleOptions={12}
    />
  )
}