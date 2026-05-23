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
}

export interface ContentCalendar {
  id: string
  user_id: string
  month_year: string
  days: CalendarDay[]
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

export interface RoadmapItem {
  priority: number
  title: string
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  weekly_actions: string[]
}

export interface Roadmap {
  id: string
  user_id: string
  brain_dump: string
  generated_plan: {
    summary: string
    priorities: RoadmapItem[]
  } | null
  created_at: string
  updated_at: string
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
