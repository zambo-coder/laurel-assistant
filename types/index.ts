export interface SocialLink {
  label: string
  url: string
}

export interface BrandProfile {
  id: string
  user_id: string
  business_name: string
  tagline: string
  target_clients: string
  design_style: string
  services_pricing: string
  business_goals: string
  instagram_handle: string
  languages: string[]
  website_url: string
  etsy_url: string
  logo_url: string
  social_links?: SocialLink[]
  dashboard_widgets?: DashboardWidget[]
  task_categories?: { name: string; color: string }[]
  ai_text_model?: string
  ai_image_model?: string
  created_at: string
  updated_at: string
}

export interface Caption {
  text: string
  hashtags: {
    niche: string[]
    broad: string[]
    local: string[]
  }
}

export interface CaptionHistory {
  id: string
  user_id: string
  prompt: string
  captions: Caption[]
  created_at: string
}

export interface CalendarDay {
  day: number
  theme: string
  post_idea: string
  format: 'reel' | 'carousel' | 'story' | 'static'
  status?: 'idea' | 'planning' | 'filming' | 'editing' | 'scheduled' | 'posted'
  notes?: string
  caption?: string
  posted_at?: string
}

export interface Project {
  id: string
  user_id: string
  title: string
  type: 'content' | 'client' | 'general'
  status: 'active' | 'completed' | 'archived'
  due_date?: string
  focus_area_id?: string
  goal_id?: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'done'
  category: string
  priority: 'low' | 'medium' | 'high'
  due_date?: string
  month_year?: string
  calendar_day?: number
  batch_group?: string
  project_id?: string
  goal_id?: string
  focus_area_id?: string
  depends_on: string[]
  source: 'manual' | 'calendar' | 'ai'
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  user_id: string
  title: string
  description?: string
  timeframe: 'annual' | 'vision'
  status: 'active' | 'achieved' | 'abandoned'
  source: 'manual' | 'strategy_advisor'
  created_at: string
  updated_at: string
}

export interface FocusArea {
  id: string
  user_id: string
  title: string
  description?: string
  goal_id?: string
  quarter?: string
  key_results: string[]
  status: 'active' | 'completed' | 'paused'
  source: 'manual' | 'strategy_advisor' | 'opportunities'
  created_at: string
  updated_at: string
}

export interface CalendarFramework {
  posts_per_week: number
  posting_days: number[]  // 0=Sun, 1=Mon, ... 6=Sat
  monthly_focus: string
}

export interface ContentCalendar {
  id: string
  user_id: string
  month_year: string
  days: CalendarDay[]
  framework?: CalendarFramework
  created_at: string
  updated_at: string
}

export interface TimeLog {
  id: string
  user_id: string
  activity_type: string
  hours_spent: number
  log_date: string
  notes?: string
  created_at: string
}

export interface OutcomeLog {
  id: string
  user_id: string
  channel: string
  inquiries: number
  conversions: number
  revenue: number
  log_date: string
  created_at: string
}

export interface Campaign {
  id: string
  user_id: string
  goal: string
  plan: {
    overview: string
    daily_plan: Array<{
      day: number
      theme: string
      content: string
      format: string
      engagement_tactics?: string
    }>
    story_ideas: string[]
    budget_guide?: string
  } | null
  created_at: string
}

export interface WebsiteCopy {
  id: string
  user_id: string
  description: string
  language: string
  generated_copy: string
  created_at: string
}

export interface ClientInquiry {
  id: string
  user_id: string
  inquiry: string
  response: string
  service_suggestion: string
  flags: string[]
  created_at: string
}

export interface InspirationRef {
  id: string
  user_id: string
  name: string
  url?: string
  platform: 'instagram' | 'website' | 'etsy' | 'pinterest' | 'other'
  aspect_tags: string[]
  notes: string
  created_at: string
}

export interface PresenceAnalysis {
  id: string
  user_id: string
  url: string
  platform: string
  analysis: {
    completeness: { score: number; notes: string }
    customer_impression: string
    vs_references: string
    gaps: string[]
    technical?: { https: boolean; score_note: string }
  } | null
  analyzed_at: string
}

export interface OpportunityItem {
  title: string
  category: 'social' | 'commercial' | 'brand' | 'technical'
  impact: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  description: string
  next_step: string
}

export interface Conversation {
  id: string
  user_id: string
  name: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Asset {
  id: string
  user_id: string
  name: string
  type: 'design' | 'brand' | 'mockup'
  url: string
  storage_path: string
  mime_type?: string
  size_bytes?: number
  tags: string[]
  notes?: string
  source: 'upload' | 'ai_generated'
  source_asset_id?: string
  created_at: string
}

export type DashboardWidget =
  | 'chat' | 'quick_actions' | 'top_opportunities'
  | 'recent_captions' | 'website_card' | 'upcoming_posts' | 'tasks'
