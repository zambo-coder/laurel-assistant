import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: brand }, { data: recentCaptions }, { data: recentInquiries }, { data: opportunities }, { data: calendar }] = await Promise.all([
    supabase.from('brand_profile').select('*').single(),
    supabase.from('caption_history').select('id, prompt, created_at').order('created_at', { ascending: false }).limit(3),
    supabase.from('client_inquiries').select('id, inquiry, created_at').order('created_at', { ascending: false }).limit(3),
    supabase.from('opportunities').select('items, generated_at').order('generated_at', { ascending: false }).limit(1).single(),
    supabase.from('content_calendar')
      .select('days, month_year')
      .gte('month_year', new Date().toISOString().slice(0, 7))
      .order('month_year', { ascending: true })
      .limit(1)
      .single(),
  ])

  return (
    <DashboardClient
      brand={brand}
      recentCaptions={recentCaptions ?? []}
      recentInquiries={recentInquiries ?? []}
      topOpportunities={opportunities?.items?.slice(0, 3) ?? []}
      calendarDays={(calendar as { days?: { day: number; theme: string; post_idea: string; format: string }[] } | null)?.days ?? []}
      calendarMonth={(calendar as { month_year?: string } | null)?.month_year ?? ''}
    />
  )
}
