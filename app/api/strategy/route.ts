import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { logUsage } from '@/lib/usage'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { InspirationRef } from '@/types'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const [
    { data: brand },
    { data: refs },
    { data: presenceRows },
    { data: opportunities },
    { data: roiRows },
    { data: calendarRows },
    { data: openTasks },
  ] = await Promise.all([
    supabase.from('brand_profile').select('*').single(),
    supabase.from('inspiration_refs').select('*').order('created_at', { ascending: false }),
    supabase.from('presence_analysis').select('url, platform, analysis, analyzed_at').order('analyzed_at', { ascending: false }).limit(10),
    supabase.from('opportunities').select('items').order('generated_at', { ascending: false }).limit(1).single(),
    supabase.from('roi_entries').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('content_calendar').select('month_year, days, framework').order('month_year', { ascending: false }).limit(3),
    supabase.from('tasks').select('title, status, priority, category, due_date').eq('user_id', user.id).neq('status', 'done').limit(20),
  ])

  if (!brand) return Response.json({ error: 'Brand profile not found' }, { status: 404 })
  const model = brand.ai_text_model || MODEL

  // Build presence summary
  const seenPlatforms = new Set<string>()
  const presenceSummary = (presenceRows ?? []).filter(r => {
    if (seenPlatforms.has(r.platform)) return false
    seenPlatforms.add(r.platform)
    return true
  }).map(r => {
    const a = r.analysis
    if (!a) return `${r.platform}: not yet analysed`
    return `${r.platform}: completeness ${a.completeness?.score ?? '?'}/100. Gaps: ${(a.gaps ?? []).slice(0, 3).join(', ')}`
  }).join('\n') || 'No presence analyses yet'

  // Build ROI summary
  const roiSummary = roiRows?.length
    ? roiRows.slice(0, 10).map(r => {
        const parts = [`${r.type ?? 'project'}: ${r.title ?? 'untitled'}`]
        if (r.revenue) parts.push(`revenue €${r.revenue}`)
        if (r.time_hours) parts.push(`${r.time_hours}h`)
        if (r.platform) parts.push(`via ${r.platform}`)
        return parts.join(' | ')
      }).join('\n')
    : 'No ROI data yet'

  // Build task summary
  const taskSummary = openTasks?.length
    ? openTasks.map(t => `[${t.priority}] ${t.title} (${t.category})`).join('\n')
    : 'No open tasks'

  // Build content cadence summary
  const contentSummary = (calendarRows ?? []).map(row => {
    const fw = row.framework
    if (!fw) return `${row.month_year}: ${(row.days ?? []).length} posts`
    const dayCount = (row.days ?? []).length
    return `${row.month_year}: ${dayCount} posts, focus: ${fw.monthly_focus ?? 'none'}`
  }).join('\n') || 'No calendar data yet'

  const systemPrompt = `${buildBrandSystemPrompt(brand, refs as InspirationRef[])}

You are a strategic business advisor. Analyse the actual business data provided and give specific, actionable recommendations. Be direct and concrete — not generic. Base every insight on the real data shown.`

  const userPrompt = `BUSINESS DATA TO ANALYSE:

ONLINE PRESENCE:
${presenceSummary}

RECENT WORK & ROI:
${roiSummary}

CONTENT CADENCE (recent months):
${contentSummary}

OPEN TASKS RIGHT NOW:
${taskSummary}

Based on this real data, provide a strategic analysis. Return ONLY valid JSON — no markdown fences, no extra text:
{
  "summary": "<2–3 sentences: what the data shows about the business right now>",
  "strengths": [
    { "title": "<strength>", "evidence": "<what in the data shows this>" }
  ],
  "gaps": [
    { "title": "<gap or risk>", "evidence": "<what in the data shows this>", "urgency": "high|medium|low" }
  ],
  "actions": [
    {
      "title": "<specific action>",
      "rationale": "<1 sentence: why this action, based on the data>",
      "effort": "low|medium|high",
      "impact": "high|medium|low",
      "this_week": "<single concrete first step>"
    }
  ]
}

Include 2–4 strengths, 2–4 gaps, and 4–6 prioritised actions (high-impact first). Be specific to her business.`

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    logUsage(supabase, user.id, 'anthropic', model, 'strategy', message.usage.input_tokens, message.usage.output_tokens)
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: 'Could not parse analysis' }, { status: 500 })

    const analysis = JSON.parse(jsonMatch[0])

    // Save to strategy_plans table for persistence
    await supabase.from('strategy_plans').upsert({
      user_id: user.id,
      brain_dump: '',
      generated_plan: analysis,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return Response.json(analysis)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('strategy_plans')
    .select('generated_plan, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!data?.generated_plan) return Response.json(null)

  // Only return if it looks like a strategy analysis (has 'strengths' key)
  if (!data.generated_plan.strengths) return Response.json(null)

  return Response.json({ ...data.generated_plan, _updated_at: data.updated_at })
}
