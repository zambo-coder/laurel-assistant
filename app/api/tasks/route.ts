import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  const status = req.nextUrl.searchParams.get('status')
  const category = req.nextUrl.searchParams.get('category')
  const monthYear = req.nextUrl.searchParams.get('month_year')
  const calendarDay = req.nextUrl.searchParams.get('calendar_day')
  const scheduleMonth = req.nextUrl.searchParams.get('schedule_month')

  if (status && status !== 'all') query = query.eq('status', status)
  if (category && category !== 'all') query = query.eq('category', category)
  if (monthYear) query = query.eq('month_year', monthYear)
  if (calendarDay) query = query.eq('calendar_day', parseInt(calendarDay))
  if (scheduleMonth) {
    const [y, m] = scheduleMonth.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const startDate = `${scheduleMonth}-01`
    const endDate = `${scheduleMonth}-${String(lastDay).padStart(2, '0')}`
    query = query.or(`month_year.eq.${scheduleMonth},and(due_date.gte.${startDate},due_date.lte.${endDate})`)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const { title, description, status, category, priority, due_date, month_year, calendar_day, batch_group, depends_on, source, goal_id, focus_area_id, project_id } = body

  if (!title?.trim()) return Response.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description ?? null,
      status: status ?? 'todo',
      category: category ?? 'general',
      priority: priority ?? 'medium',
      due_date: due_date ?? null,
      month_year: month_year ?? null,
      calendar_day: calendar_day ?? null,
      batch_group: batch_group ?? null,
      depends_on: depends_on ?? [],
      source: source ?? 'manual',
      goal_id: goal_id ?? null,
      focus_area_id: focus_area_id ?? null,
      project_id: project_id ?? null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
