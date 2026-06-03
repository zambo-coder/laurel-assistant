import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { logUsage } from '@/lib/usage'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { after } from 'next/server'
import { NextRequest } from 'next/server'
import { CalendarDay, InspirationRef } from '@/types'

// GET — load messages for a conversation
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const conversationId = req.nextUrl.searchParams.get('conversation_id')
  if (!conversationId) return Response.json([])

  const { data } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200)

  return Response.json(data ?? [])
}

// DELETE — clear messages for a conversation
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const conversationId = req.nextUrl.searchParams.get('conversation_id')
  if (!conversationId) return new Response('conversation_id required', { status: 400 })

  await supabase.from('chat_messages').delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  return new Response(null, { status: 204 })
}

// PATCH — save a user+assistant message pair (called by client after streaming)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { conversation_id, user_content, assistant_content } = await req.json()

  const { error } = await supabase.from('chat_messages').insert([
    { user_id: user.id, conversation_id, role: 'user', content: user_content },
    { user_id: user.id, conversation_id, role: 'assistant', content: assistant_content },
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  void supabase.from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversation_id)
    .eq('user_id', user.id)

  return new Response(null, { status: 204 })
}

// Calendar tool definition
const CALENDAR_TOOL = {
  name: 'save_calendar_entry',
  description: "Save agreed content calendar entries to the user's calendar. Use this when the user explicitly asks to add, schedule, or save post ideas to their calendar. Always describe in text what you're saving before calling this tool.",
  input_schema: {
    type: 'object' as const,
    properties: {
      month_year: { type: 'string', description: 'Month and year in YYYY-MM format' },
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'number' },
            theme: { type: 'string' },
            post_idea: { type: 'string' },
            format: { type: 'string', enum: ['reel', 'carousel', 'story', 'static'] },
          },
          required: ['day', 'theme', 'post_idea', 'format'],
        },
      },
    },
    required: ['month_year', 'entries'],
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveCalendarEntries(userId: string, supabase: any, monthYear: string, entries: Array<{ day: number; theme: string; post_idea: string; format: string }>) {
  const { data: existing } = await supabase
    .from('content_calendar')
    .select('days')
    .eq('user_id', userId)
    .eq('month_year', monthYear)
    .single()

  const merged: CalendarDay[] = [...(existing?.days ?? [])]
  for (const entry of entries) {
    const idx = merged.findIndex(d => d.day === entry.day)
    const newDay: CalendarDay = {
      day: entry.day,
      theme: entry.theme,
      post_idea: entry.post_idea,
      format: (['reel', 'carousel', 'story', 'static'].includes(entry.format) ? entry.format : 'static') as CalendarDay['format'],
    }
    if (idx >= 0) merged[idx] = newDay
    else { merged.push(newDay); merged.sort((a, b) => a.day - b.day) }
  }

  await supabase.from('content_calendar').upsert({
    user_id: userId, month_year: monthYear, days: merged, updated_at: new Date().toISOString(),
  })
}

// POST — stream AI response (message saving handled client-side via PATCH)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json()

  const { data: brand } = await supabase.from('brand_profile').select('*').single()
  if (!brand) return new Response('Brand profile not found', { status: 404 })

  const [{ data: recentCaptions }, { data: recentInquiries }, { data: timeLogs }, { data: refs }, { data: openTasks }] = await Promise.all([
    supabase.from('caption_history').select('prompt').order('created_at', { ascending: false }).limit(5),
    supabase.from('client_inquiries').select('inquiry').order('created_at', { ascending: false }).limit(5),
    supabase.from('time_logs').select('activity_type, hours_spent').order('log_date', { ascending: false }).limit(10),
    supabase.from('inspiration_refs').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('title, status, priority, due_date, category').neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }).limit(15),
  ])

  const contextBlocks: string[] = []
  if (recentCaptions?.length) contextBlocks.push(`Recent caption prompts: ${recentCaptions.map(c => c.prompt).join('; ')}`)
  if (recentInquiries?.length) contextBlocks.push(`Recent client inquiries: ${recentInquiries.map(c => c.inquiry.slice(0, 80)).join(' | ')}`)
  if (timeLogs?.length) {
    const byActivity: Record<string, number> = {}
    timeLogs.forEach(l => { byActivity[l.activity_type] = (byActivity[l.activity_type] || 0) + Number(l.hours_spent) })
    contextBlocks.push(`Recent time tracked: ${Object.entries(byActivity).map(([k, v]) => `${k}: ${v}h`).join(', ')}`)
  }
  if (openTasks?.length) {
    const taskLines = openTasks.map(t => {
      const due = t.due_date ? ` (due ${t.due_date})` : ''
      return `- [${t.status}] ${t.title}${due}`
    }).join('\n')
    contextBlocks.push(`Open tasks:\n${taskLines}`)
  }

  const systemPrompt = `${buildBrandSystemPrompt(brand, refs as InspirationRef[])}

CURRENT CONTEXT:
${contextBlocks.length ? contextBlocks.join('\n') : 'No activity data yet.'}

You are a conversational business co-pilot. Be concise, warm, and specific to her business.
You can help with: content ideas, replying to clients, strategic thinking, planning, copy, and anything else she needs.
Keep responses focused — no fluff.
Today's date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current month: ${new Date().toISOString().slice(0, 7)}

CALENDAR TOOL: Use save_calendar_entry when the user explicitly wants to save posts to their calendar. Always confirm in text first what you are saving, then call the tool.`

  const model = brand.ai_text_model || MODEL
  try {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: [CALENDAR_TOOL],
      tool_choice: { type: 'auto' },
    })

    const finalMsgPromise = stream.finalMessage()
    const encoder = new TextEncoder()

    // Schedule post-response work (usage logging + calendar tool execution)
    after(async () => {
      try {
        const finalMsg = await finalMsgPromise
        logUsage(supabase, user.id, 'anthropic', model, 'chat', finalMsg.usage.input_tokens, finalMsg.usage.output_tokens)
        for (const block of finalMsg.content) {
          if (block.type === 'tool_use' && block.name === 'save_calendar_entry') {
            const input = block.input as { month_year: string; entries: Array<{ day: number; theme: string; post_idea: string; format: string }> }
            await saveCalendarEntries(user.id, supabase, input.month_year, input.entries)
          }
        }
      } catch { /* non-fatal */ }
    })

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          controller.error(err)
          return
        }
        controller.close()
      },
    })

    return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
