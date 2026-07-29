'use client'

import type { ProjectListItem } from '@/lib/types'
import EntityCombobox from './EntityCombobox'

// Thin wrapper over EntityCombobox that keeps the (value: string) API its callers
// use. `projects` is only needed to resolve the current selection's label.
export default function ProjectSelector({
  label,
  value,
  projects,
  onChange,
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
    <EntityCombobox
      label={label}
      entity="project"
      value={value}
      selectedLabel={projects.find((project) => project.id === value)?.name}
      onChange={(opt) => onChange(opt.id)}
      disabled={disabled}
      clearable
    />
  )
}
