export type ChecklistItem = {
  id: string
  title: string
  done: boolean
}

export type TaskDependencyPreview = {
  id: string
  title: string
  status: string
  scheduled_date: string
}

export type AssignmentRow = {
  id: string
  profile_id: string
  profile_name: string
  profile_email: string | null
  status: 'assigned' | 'accepted' | 'declined' | 'completed'
}

export type TaskRow = {
  id: string
  workspace_id: string
  scheduled_date: string
  planned_start_time?: string | null
  task_color?: string | null
  category?: string | null
  title: string
  description: string | null
  duration_minutes: number
  required_people: number
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'assigned' | 'in_progress' | 'done' | 'cancelled'
  sort_order: number
  checklist_items: ChecklistItem[]
  recurrence_cadence?: 'weekly' | 'monthly' | null
  recurrence_interval?: number
  recurrence_end_date?: string | null
  recurrence_parent_task_id?: string | null
  blocked_by_tasks: TaskDependencyPreview[]
  blocking_tasks: TaskDependencyPreview[]
  assignments: AssignmentRow[]
  created_at?: string
  updated_at?: string
}

export type TaskTemplate = {
  id: string
  workspace_id: string
  title: string
  description: string | null
  category: string | null
  planned_start_time: string | null
  task_color: string | null
  duration_minutes: number
  required_people: number
  priority: string
  checklist_items: ChecklistItem[]
  created_at?: string
  updated_at?: string
}
