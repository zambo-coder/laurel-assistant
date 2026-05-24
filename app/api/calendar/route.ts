import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { streamToResponse } from '@/lib/stream'
import { NextRequest } from 'next/server'
import { CalendarDay } from '@/types'

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

  const { month_year, focus, days_in_month } = await req.json()

  const { data: brand } = await supabase.from('brand_profile').select('*').single()
  if (!brand) return new Response('Brand profile not found', { status: 404 })

  const systemPrompt = `${buildBrandSystemPrompt(brand)}

Generate a ${days_in_month}-day Instagram content calendar for ${month_year}.
Output EXACTLY ${days_in_month} lines — one per day — in this pipe-delimited format with NO extra text:
DAY_1|format|theme|post_idea
DAY_2|format|theme|post_idea
...

Rules:
- format must be one of: reel, carousel, story, static
- theme: 2-5 words (e.g. "Behind the scenes", "Client feature", "Design process")
- post_idea: one concrete, actionable sentence describing the post content
- Vary formats: ~30% reels, ~25% carousels, ~25% static, ~20% stories
- Mix content pillars: design process, finished work, personal brand, client stories, tips, seasonal`

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Create content calendar for ${month_year}.${focus ? ` Focus: ${focus}` : ''}` }],
    })

    stream.finalMessage().then(msg => {
      const fullText = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const days = parseCalendar(fullText)
      if (days.length > 0) {
        void supabase.from('content_calendar').upsert({
          user_id: user.id,
          month_year,
          days,
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
      messages: [{ role: 'user', content: `Regenerate day ${day} for ${month_year}.` }],
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
