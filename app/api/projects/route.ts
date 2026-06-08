import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { title, type = 'general', status = 'active', due_date, focus_area_id, goal_id, calendar_month_year, calendar_day } = await req.json()
  if (!title?.trim()) return Response.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, title: title.trim(), type, status, due_date: due_date ?? null, focus_area_id: focus_area_id ?? null, goal_id: goal_id ?? null, calendar_month_year: calendar_month_year ?? null, calendar_day: calendar_day ?? null })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
