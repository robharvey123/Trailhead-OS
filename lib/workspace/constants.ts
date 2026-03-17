export const WORKSPACE_TASK_CATEGORIES = ['sales', 'marketing', 'operations', 'finance', 'product'] as const
export type WorkspaceTaskCategory = (typeof WORKSPACE_TASK_CATEGORIES)[number]

export type WorkspaceTaskCategoryFilter = 'all' | 'uncategorized' | WorkspaceTaskCategory
export const WORKSPACE_CATEGORY_LABELS: Record<WorkspaceTaskCategory, string> = {
  sales: 'Sales',
  marketing: 'Marketing',
  operations: 'Operations',
  finance: 'Finance',
  product: 'Product',
}

export const WORKSPACE_TABLES = {
  tasks: 'workspace_tasks',
  assignments: 'workspace_assignments',
  dependencies: 'workspace_task_dependencies',
  activity: 'workspace_task_activity',
  templates: 'workspace_task_templates',
} as const

export function normalizeWorkspaceTaskCategory(value?: string | null): WorkspaceTaskCategory | null {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null
  return WORKSPACE_TASK_CATEGORIES.includes(normalized as WorkspaceTaskCategory)
    ? (normalized as WorkspaceTaskCategory)
    : null
}

export function workspaceCategoryLabel(value?: string | null) {
  const normalized = normalizeWorkspaceTaskCategory(value)
  return normalized ? WORKSPACE_CATEGORY_LABELS[normalized] : 'Uncategorized'
}
