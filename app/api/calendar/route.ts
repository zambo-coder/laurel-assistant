import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { logUsage } from '@/lib/usage'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { streamToResponse } from '@/lib/stream'
import { NextRequest } from 'next/server'
import { CalendarDay, CalendarFramework, InspirationRef } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const month_year = req.nextUrl.searchParams.get('month_year')
  if (!month_year) return Response.json({ error: 'month_year required' }, { status: 400 })

  const { data } = await supabase
    .from('content_calendar')
    .select('*')
    .eq('month_year', month_year)
    .single()

  return Response.json(data ?? null)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { month_year, days_in_month, framework } = await req.json() as {
    month_year: string
    days_in_month: number
    framework: CalendarFramework
  }

  const [{ data: brand }, { data: refs }] = await Promise.all([
    supabase.from('brand_profile').select('*').single(),
    supabase.from('inspiration_refs').select('*').order('created_at', { ascending: false }),
  ])
  if (!brand) return new Response('Brand profile not found', { status: 404 })
  const model = brand.ai_text_model || MODEL

  // Save framework to brand profile for reuse next month
  void supabase.from('brand_profile').update({
    calendar_framework: framework,
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id)

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const postingDayNames = framework.posting_days.map(d => DAY_NAMES[d]).join(', ')

  // Calculate which calendar days (1–N) are posting days
  const [year, month] = month_year.split('-').map(Number)
  const postingCalendarDays: number[] = []
  for (let d = 1; d <= days_in_month; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (framework.posting_days.includes(dow)) postingCalendarDays.push(d)
  }

  const systemPrompt = `${buildBrandSystemPrompt(brand, refs as InspirationRef[])}

Generate an Instagram content calendar for ${month_year}.

POSTING SCHEDULE (agreed by user):
- Post ONLY on these days of the week: ${postingDayNames}
- That gives ${postingCalendarDays.length} posts this month on days: ${postingCalendarDays.join(', ')}
- Output ONLY lines for these ${postingCalendarDays.length} days — nothing else
${framework.monthly_focus ? `- MONTHLY FOCUS: ${framework.monthly_focus}` : ''}

Output format — one line per posting day, pipe-delimited, NO extra text:
DAY_<number>|format|theme|post_idea

Rules:
- format: reel, carousel, story, or static — vary naturally across the month
- theme: 2-5 words
- post_idea: one concrete, specific sentence
- Mix content: finished work, design process, personal brand, client stories, tips`

  try {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Create the content calendar for ${month_year}.` }],
    })

    stream.finalMessage().then(msg => {
      logUsage(supabase, user.id, 'anthropic', model, 'calendar_generate', msg.usage.input_tokens, msg.usage.output_tokens)
    }).catch(() => {})

    return streamToResponse(stream)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()

  // action: 'save_all' — save a full set of days (proposal → confirmed)
  if (body.action === 'save_all') {
    const { month_year, days, framework } = body as { month_year: string; days: CalendarDay[]; framework?: CalendarFramework }
    const { error } = await supabase.from('content_calendar').upsert({
      user_id: user.id,
      month_year,
      days,
      ...(framework ? { framework } : {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,month_year' })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return new Response(null, { status: 204 })
  }

  // action: 'update' — save edits to an existing day (supports moving to a different day)
  if (body.action === 'update') {
    const { month_year, day, updates } = body as { month_year: string; day: number; updates: Partial<CalendarDay> }

    const { data: existing, error: fetchErr } = await supabase
      .from('content_calendar')
      .select('days')
      .eq('user_id', user.id)
      .eq('month_year', month_year)
      .single()

    if (fetchErr || !existing) return Response.json({ error: 'Calendar not found' }, { status: 404 })

    let days: CalendarDay[] = existing.days ?? []
    const targetDay = updates.day ?? day

    if (targetDay !== day) {
      const sourceEntry = days.find(d => d.day === day)
      days = days.filter(d => d.day !== day && d.day !== targetDay)
      if (sourceEntry) days.push({ ...sourceEntry, ...updates, day: targetDay })
    } else {
      const idx = days.findIndex(d => d.day === day)
      if (idx >= 0) {
        days[idx] = { ...days[idx], ...updates }
      } else {
        days.push({ day, theme: '', post_idea: '', format: 'static', ...updates })
      }
    }

    days.sort((a, b) => a.day - b.day)

    const { error } = await supabase
      .from('content_calendar')
      .update({ days, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('month_year', month_year)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return new Response(null, { status: 204 })
  }

  // action: 'propose' (default) — return an AI-suggested day without saving
  const { month_year, day } = body

  const { data: brand } = await supabase.from('brand_profile').select('*').single()
  if (!brand) return Response.json({ error: 'Brand profile not found' }, { status: 404 })
  const proposeModel = brand.ai_text_model || MODEL

  try {
    const message = await anthropic.messages.create({
      model: proposeModel,
      max_tokens: 200,
      system: `${buildBrandSystemPrompt(brand)}\nOutput exactly one line: DAY_${day}|format|theme|post_idea`,
      messages: [{ role: 'user', content: `Suggest a new post idea for day ${day} of ${month_year}.` }],
    })

    logUsage(supabase, user.id, 'anthropic', proposeModel, 'calendar_suggest', message.usage.input_tokens, message.usage.output_tokens)
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const days = parseCalendar(text)
    if (!days[0]) return Response.json({ error: 'Could not parse response' }, { status: 500 })
    return Response.json(days[0])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return Response.json({ error: message }, { status: 500 })
  }
}

export function parseCalendar(text: string): CalendarDay[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const days: CalendarDay[] = []
  for (const line of lines) {
    const match = line.match(/^DAY_(\d+)\|(\w+)\|([^|]+)\|(.+)$/i)
    if (match) {
      const format = match[2].toLowerCase()
      days.push({
        day: parseInt(match[1]),
        format: (['reel', 'carousel', 'story', 'static'].includes(format) ? format : 'static') as CalendarDay['format'],
        theme: match[3].trim(),
        post_idea: match[4].trim(),
      })
    }
  }
  return days
}
