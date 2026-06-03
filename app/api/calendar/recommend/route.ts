import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { logUsage } from '@/lib/usage'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { NextRequest } from 'next/server'
import { CalendarFramework } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { month_year } = await req.json()

  const { data: brand } = await supabase.from('brand_profile').select('*').single()
  if (!brand) return Response.json({ error: 'Brand profile not found' }, { status: 404 })
  const model = brand.ai_text_model || MODEL

  // Parse month for context
  const [year, month] = month_year.split('-').map(Number)
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long' })
  const season = getSeason(month)

  const systemPrompt = `${buildBrandSystemPrompt(brand)}

You are advising on an Instagram posting strategy. Be specific, practical, and base your advice on:
- What actually works for Instagram's algorithm in 2025/2026
- The nature of her business (wedding stationery, boutique, seasonal)
- The current month and season
- A realistic solo-designer workload

Respond in JSON only. No extra text.`

  const userPrompt = `Recommend a posting framework for ${monthName} ${year} (${season}).

Return ONLY valid JSON in this exact shape:
{
  "reasoning": "2-3 sentences explaining the recommendation in plain, warm language — mention the month/season, why these specific days, and the tradeoff between optimal and realistic",
  "framework": {
    "posts_per_week": <number 3-5>,
    "posting_days": [<array of day numbers, 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat>],
    "monthly_focus": ""
  }
}`

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    logUsage(supabase, user.id, 'anthropic', model, 'calendar_recommend', message.usage.input_tokens, message.usage.output_tokens)
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse recommendation')

    const parsed = JSON.parse(jsonMatch[0]) as {
      reasoning: string
      framework: CalendarFramework
    }

    // Also check if they have a saved framework — use that as override but keep reasoning
    const savedFramework = brand.calendar_framework as CalendarFramework | null
    if (savedFramework) {
      parsed.framework = { ...parsed.framework, ...savedFramework }
    }

    return Response.json(parsed)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate recommendation'
    return Response.json({ error: message }, { status: 500 })
  }
}

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return 'spring — engagement season ramps up'
  if (month >= 6 && month <= 8) return 'summer — peak wedding season'
  if (month >= 9 && month <= 11) return 'autumn — booking season for next year'
  return 'winter — quieter season, great for brand building'
}
