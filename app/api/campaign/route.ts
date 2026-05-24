import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { streamToResponse } from '@/lib/stream'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { goal, service_description, include_budget } = await req.json()

  const { data: brand } = await supabase.from('brand_profile').select('*').single()
  if (!brand) return new Response('Brand profile not found', { status: 404 })

  const systemPrompt = `${buildBrandSystemPrompt(brand)}

Create a 14-day Instagram mini-campaign in this EXACT format:

OVERVIEW: [1-2 sentence campaign summary]
---
DAY_1|format|theme|content_idea|engagement_tactic
DAY_2|format|theme|content_idea|engagement_tactic
[continue through DAY_14]
---
STORY_IDEAS: [idea 1] | [idea 2] | [idea 3] | [idea 4] | [idea 5]
${include_budget ? 'BUDGET: [practical boosting tips for a small budget — 50-100 EUR/month]' : ''}

format: reel, carousel, story, or static
theme: 3-5 words
content_idea: one specific actionable sentence
engagement_tactic: one short action (e.g. "Ask a question in caption")`

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Goal: ${goal}${service_description ? `\nService: ${service_description}` : ''}` }],
    })

    stream.finalMessage().then(msg => {
      const fullText = msg.content[0].type === 'text' ? msg.content[0].text : ''
      void supabase.from('campaigns').insert({
        user_id: user.id,
        goal,
        plan: { raw: fullText },
      })
    }).catch(() => {})

    return streamToResponse(stream)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
