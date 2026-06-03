import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { logUsage } from '@/lib/usage'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { streamToResponse } from '@/lib/stream'
import { InspirationRef, OpportunityItem } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('opportunities')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  return Response.json(data ?? null)
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const [{ data: brand }, { data: refs }, { data: presenceRows }] = await Promise.all([
    supabase.from('brand_profile').select('*').single(),
    supabase.from('inspiration_refs').select('*').order('created_at', { ascending: false }),
    supabase.from('presence_analysis').select('url, platform, analysis, analyzed_at').order('analyzed_at', { ascending: false }).limit(10),
  ])
  if (!brand) return Response.json({ error: 'Brand profile not found' }, { status: 404 })
  const model = brand.ai_text_model || MODEL

  // Deduplicate presence analyses — keep most recent per platform
  const seenPlatforms = new Set<string>()
  const presenceContext = (presenceRows ?? []).filter(r => {
    if (seenPlatforms.has(r.platform)) return false
    seenPlatforms.add(r.platform)
    return true
  }).map(r => {
    const a = r.analysis
    if (!a) return `${r.platform} (${r.url}): not yet analysed`
    return `${r.platform} (${r.url}): completeness ${a.completeness?.score}/100. Gaps: ${a.gaps?.join('; ')}`
  }).join('\n')

  const systemPrompt = `${buildBrandSystemPrompt(brand, refs as InspirationRef[])}

You are a strategic business advisor. Synthesise all the context below to identify the highest-leverage opportunities.
Return ONLY a valid JSON array — no markdown fences, no extra text.`

  const userPrompt = `PRESENCE ANALYSIS:
${presenceContext || 'No presence analyses yet.'}

Based on everything above — brand goals, inspiration references, and presence analysis — identify 8–12 specific, actionable opportunities ordered from highest to lowest priority.

Return a JSON array of objects with this exact shape:
[
  {
    "title": "<short title, max 8 words>",
    "category": "<social|commercial|brand|technical>",
    "impact": "<high|medium|low>",
    "effort": "<low|medium|high>",
    "description": "<2 sentences explaining why this matters>",
    "next_step": "<one specific, concrete action she can take this week>"
  }
]

Prioritise high-impact + low-effort items first. Be specific to her business — not generic advice.`

  try {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    stream.finalMessage().then(msg => {
      logUsage(supabase, user.id, 'anthropic', model, 'opportunities', msg.usage.input_tokens, msg.usage.output_tokens)
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) return
        const items: OpportunityItem[] = JSON.parse(jsonMatch[0])
        void supabase.from('opportunities').insert({
          user_id: user.id,
          items,
          generated_at: new Date().toISOString(),
        })
      } catch { /* parse failure — don't save */ }
    }).catch(() => {})

    return streamToResponse(stream)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
