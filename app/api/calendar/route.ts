import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { streamToResponse } from '@/lib/stream'
import { NextRequest } from 'next/server'
import { CalendarDay, CalendarFramework } from '@/types'

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

  const { data: brand } = await supabase.from('brand_profile').select('*').single()
  if (!brand) return new Response('Brand profile not found', { status: 404 })

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

  const systemPrompt = `${buildBrandSystemPrompt(brand)}

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
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Create the content calendar for ${month_year}.` }],
    })

    stream.finalMessage().then(msg => {
      const fullText = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const days = parseCalendar(fullText)
      if (days.length > 0) {
        void supabase.from('content_calendar').upsert({
          user_id: user.id,
          month_year,
          days,
          framework,
          updated_at: new Date().toISOString(),
        })
      }
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

  const { month_year, day } = await req.json()

  const { data: brand } = await supabase.from('brand_profile').select('*').single()
  if (!brand) return Response.json({ error: 'Brand profile not found' }, { status: 404 })

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: `${buildBrandSystemPrompt(brand)}\nOutput exactly one line: DAY_${day}|format|theme|post_idea`,
      messages: [{ role: 'user', content: `Suggest a new post idea for day ${day} of ${month_year}.` }],
    })

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
