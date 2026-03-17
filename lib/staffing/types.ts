// ============================================================
// Staffing Types
// ============================================================

export type Department = 'sales' | 'marketing' | 'operations' | 'finance' | 'product' | 'logistics' | 'management' | 'other'
export type EmploymentType = 'full_time' | 'part_time' | 'contractor' | 'intern'
export type ScheduleType = 'work' | 'meeting' | 'break' | 'leave' | 'holiday' | 'training'

export type StaffProfile = {
  id: string
  workspace_id: string
  user_id: string
  display_name: string
  email: string | null
  phone: string | null
  department: Department | null
  role_title: string | null
  employment_type: EmploymentType
  hourly_rate: number | null
  capacity_hours_per_week: number
  start_date: string | null
  tags: string[]
  created_at?: string
  updated_at?: string
  // computed
  hours_this_week?: number
  utilization_pct?: number
}

export type StaffSchedule = {
  id: string
  workspace_id: string
  staff_profile_id: string
  date: string
  start_time: string
  end_time: string
  type: ScheduleType
  title: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
  // joined
  staff_name?: string
}

export type StaffTimeEntry = {
  id: string
  workspace_id: string
  staff_profile_id: string
  task_id: string | null
  date: string
  hours: number
  description: string | null
  billable: boolean
  created_at?: string
  updated_at?: string
  // joined
  staff_name?: string
  task_title?: string
}

// ============================================================
// Staffing Constants
// ============================================================

export const DEPARTMENTS = ['sales', 'marketing', 'operations', 'finance', 'product', 'logistics', 'management', 'other'] as const

export const DEPARTMENT_LABELS: Record<Department, string> = {
  sales: 'Sales',
  marketing: 'Marketing',
  operations: 'Operations',
  finance: 'Finance',
  product: 'Product',
  logistics: 'Logistics',
  management: 'Management',
  other: 'Other',
}

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contractor', 'intern'] as const

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contractor: 'Contractor',
  intern: 'Intern',
}

export const SCHEDULE_TYPES = ['work', 'meeting', 'break', 'leave', 'holiday', 'training'] as const

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  work: 'Work',
  meeting: 'Meeting',
  break: 'Break',
  leave: 'Leave',
  holiday: 'Holiday',
  training: 'Training',
}

export const SCHEDULE_TYPE_COLORS: Record<ScheduleType, string> = {
  work: 'bg-blue-500/20 text-blue-300',
  meeting: 'bg-purple-500/20 text-purple-300',
  break: 'bg-slate-500/20 text-slate-300',
  leave: 'bg-amber-500/20 text-amber-300',
  holiday: 'bg-emerald-500/20 text-emerald-300',
  training: 'bg-cyan-500/20 text-cyan-300',
}
