// ============================================================
// Communications Types
// ============================================================

export type ChannelType = 'general' | 'project' | 'announcement' | 'direct'

export type CommChannel = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  type: ChannelType
  is_archived: boolean
  created_by: string | null
  created_at?: string
  updated_at?: string
  // computed
  message_count?: number
  last_message_at?: string
}

export type CommMessage = {
  id: string
  workspace_id: string
  channel_id: string
  sender_id: string
  parent_message_id: string | null
  body: string
  is_edited: boolean
  is_pinned: boolean
  created_at?: string
  updated_at?: string
  // joined
  sender_name?: string
  reply_count?: number
}

export type NotificationType = 'task_assigned' | 'task_due' | 'mention' | 'message' | 'invoice' | 'deal_update' | 'system' | 'reminder'

export type Notification = {
  id: string
  workspace_id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at?: string
}

// ============================================================
// Communications Constants
// ============================================================

export const CHANNEL_TYPES = ['general', 'project', 'announcement', 'direct'] as const

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  general: 'General',
  project: 'Project',
  announcement: 'Announcement',
  direct: 'Direct Message',
}

export const NOTIFICATION_TYPES = ['task_assigned', 'task_due', 'mention', 'message', 'invoice', 'deal_update', 'system', 'reminder'] as const

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  task_assigned: 'Task Assigned',
  task_due: 'Task Due',
  mention: 'Mention',
  message: 'New Message',
  invoice: 'Invoice',
  deal_update: 'Deal Update',
  system: 'System',
  reminder: 'Reminder',
}
