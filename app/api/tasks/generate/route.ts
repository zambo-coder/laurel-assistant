import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { logUsage } from '@/lib/usage'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { month_year, day, post_idea, theme, format } = await req.json()
  if (!post_idea || !format) return Response.json({ error: 'post_idea and format required' }, { status: 400 })

  const { data: bp } = await supabase.from('brand_profile').select('ai_text_model').single()
  const model = bp?.ai_text_model || MODEL

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 400,
      system: `You are a task planner for a social media content creator. Generate a concise, practical task list for creating a single post. Return ONLY valid JSON — no markdown, no extra text.`,
      messages: [{
        role: 'user',
        content: `Generate tasks for this post:
- Day: ${day} of ${month_year}
- Theme: ${theme}
- Format: ${format}
- Idea: ${post_idea}

Return JSON:
{
  "tasks": [
    { "title": "...", "category": "content", "priority": "high|medium|low", "batch_group": "..." }
  ]
}

Rules:
- 4–6 tasks covering the full production pipeline (e.g. shoot/film, edit, write caption, add hashtags, schedule/post, engage)
- batch_group should group related tasks (e.g. "film" for shooting tasks, "edit" for editing, "publish" for post/engage)
- Keep titles short and action-oriented (verb + object)
- category: always "content"
- priority: "high" for critical path, "medium" for supporting, "low" for optional`,
      }],
    })

    logUsage(supabase, user.id, 'anthropic', model, 'tasks_generate', message.usage.input_tokens, message.usage.output_tokens)
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: 'Could not parse tasks' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])
    return Response.json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Generation failed'
    return Response.json({ error: msg }, { status: 500 })
  }
}
