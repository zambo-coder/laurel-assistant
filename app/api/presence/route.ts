import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { logUsage } from '@/lib/usage'
import { buildBrandSystemPrompt } from '@/lib/brand-context'
import { NextRequest } from 'next/server'
import { InspirationRef } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('presence_analysis')
    .select('*')
    .order('analyzed_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { url, platform } = await req.json()
  if (!url || !platform) return Response.json({ error: 'url and platform required' }, { status: 400 })

  const [{ data: brand }, { data: refs }] = await Promise.all([
    supabase.from('brand_profile').select('*').single(),
    supabase.from('inspiration_refs').select('*').order('created_at', { ascending: false }),
  ])
  if (!brand) return Response.json({ error: 'Brand profile not found' }, { status: 404 })
  const model = brand.ai_text_model || MODEL

  // Attempt to fetch website content for richer analysis
  let pageSnippet = ''
  if (platform === 'website') {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; studio-assistant/1.0)' },
        signal: AbortSignal.timeout(6000),
      })
      const html = await res.text()
      // Extract visible text snippets from title, meta description, h1-h3, and first paragraphs
      const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ''
      const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? ''
      const headings = [...html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi)].map(m => m[1]).slice(0, 6).join(' | ')
      pageSnippet = [title, metaDesc, headings].filter(Boolean).join('\n').slice(0, 800)
    } catch {
      // graceful fail — analyse without page content
    }
  }

  const hasRefs = refs && refs.length > 0
  const systemPrompt = `${buildBrandSystemPrompt(brand, refs as InspirationRef[])}

You are analysing an online presence page. Return ONLY valid JSON — no markdown, no extra text.`

  const refContext = hasRefs
    ? `Compare against the inspiration references listed in the brand context.`
    : `No inspiration references are saved yet — skip the vs_references comparison and note that.`

  const pageContext = pageSnippet
    ? `\n\nPAGE CONTENT EXTRACTED:\n${pageSnippet}`
    : ''

  const httpsOk = url.startsWith('https://')

  const userPrompt = `Analyse this ${platform} page: ${url}${pageContext}

${refContext}

Return JSON in this exact shape:
{
  "completeness": { "score": <0-100>, "notes": "<2-3 sentences on what's complete/missing>" },
  "customer_impression": "<2-3 sentences simulating an ideal client's first impression — speak as that person>",
  "vs_references": "<2-3 sentences comparing this page to her inspiration references, or note if none are saved>",
  "gaps": ["<specific actionable gap 1>", "<gap 2>", "<gap 3>", "<gap 4>"],
  "technical": { "https": ${httpsOk}, "score_note": "${httpsOk ? 'HTTPS secured' : 'No HTTPS — browsers may flag this as insecure'}" }
}`

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    logUsage(supabase, user.id, 'anthropic', model, 'presence', message.usage.input_tokens, message.usage.output_tokens)
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: 'Could not parse analysis' }, { status: 500 })

    const analysis = JSON.parse(jsonMatch[0])

    const { data: saved, error: saveError } = await supabase.from('presence_analysis').upsert({
      user_id: user.id,
      url,
      platform,
      analysis,
      analyzed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,url' }).select().single()

    if (saveError) return Response.json({ error: saveError.message }, { status: 500 })
    if (!saved) return Response.json({ error: 'Save returned no data' }, { status: 500 })

    return Response.json(saved)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('presence_analysis').delete().eq('id', id).eq('user_id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
