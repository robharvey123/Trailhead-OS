// ============================================================
// Marketing Types
// ============================================================

export type CampaignType = 'promotion' | 'launch' | 'awareness' | 'retention' | 'event' | 'seasonal' | 'other'
export type CampaignStatus = 'draft' | 'planned' | 'active' | 'paused' | 'completed' | 'cancelled'
export type CampaignChannel = 'social' | 'email' | 'paid_search' | 'display' | 'retail' | 'pr' | 'influencer' | 'multi_channel'

export type MarketingCampaign = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  type: CampaignType
  status: CampaignStatus
  channel: CampaignChannel | null
  budget_allocated: number
  budget_spent: number
  start_date: string | null
  end_date: string | null
  target_audience: string | null
  goals: string | null
  kpi_target: Record<string, unknown>
  results: CampaignResults | null
  budget_id: string | null
  tags: string[]
  owner_user_id: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
}

export type CampaignResults = {
  impressions?: number
  clicks?: number
  conversions?: number
  revenue_attributed?: number
}

export type ContentType = 'post' | 'story' | 'reel' | 'blog' | 'email' | 'ad' | 'press_release' | 'landing_page' | 'other'
export type ContentChannel = 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'twitter' | 'youtube' | 'email' | 'website' | 'other'
export type ContentStatus = 'idea' | 'draft' | 'review' | 'approved' | 'scheduled' | 'published' | 'archived'

export type MarketingContent = {
  id: string
  workspace_id: string
  campaign_id: string | null
  title: string
  content_type: ContentType
  channel: ContentChannel | null
  body: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  status: ContentStatus
  tags: string[]
  assigned_to: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
  // joined
  campaign_name?: string
}

export type AssetFileType = 'image' | 'video' | 'document' | 'audio' | 'other'

export type MarketingAsset = {
  id: string
  workspace_id: string
  campaign_id: string | null
  content_id: string | null
  name: string
  file_type: AssetFileType
  file_url: string
  file_size_bytes: number | null
  mime_type: string | null
  alt_text: string | null
  tags: string[]
  uploaded_by: string | null
  created_at?: string
}

// ============================================================
// Marketing Constants
// ============================================================

export const CAMPAIGN_TYPES = ['promotion', 'launch', 'awareness', 'retention', 'event', 'seasonal', 'other'] as const

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  promotion: 'Promotion',
  launch: 'Product Launch',
  awareness: 'Brand Awareness',
  retention: 'Retention',
  event: 'Event',
  seasonal: 'Seasonal',
  other: 'Other',
}

export const CAMPAIGN_STATUSES = ['draft', 'planned', 'active', 'paused', 'completed', 'cancelled'] as const

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const CAMPAIGN_CHANNELS = ['social', 'email', 'paid_search', 'display', 'retail', 'pr', 'influencer', 'multi_channel'] as const

export const CAMPAIGN_CHANNEL_LABELS: Record<CampaignChannel, string> = {
  social: 'Social Media',
  email: 'Email',
  paid_search: 'Paid Search',
  display: 'Display Ads',
  retail: 'Retail',
  pr: 'PR',
  influencer: 'Influencer',
  multi_channel: 'Multi-Channel',
}

export const CONTENT_TYPES = ['post', 'story', 'reel', 'blog', 'email', 'ad', 'press_release', 'landing_page', 'other'] as const

export const CONTENT_STATUSES = ['idea', 'draft', 'review', 'approved', 'scheduled', 'published', 'archived'] as const

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  idea: 'Idea',
  draft: 'Draft',
  review: 'In Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
}

export const CONTENT_CHANNELS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'youtube', 'email', 'website', 'other'] as const

export const CONTENT_CHANNEL_LABELS: Record<ContentChannel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'X (Twitter)',
  youtube: 'YouTube',
  email: 'Email',
  website: 'Website',
  other: 'Other',
}
