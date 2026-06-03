import { createClient } from '@/lib/supabase/server'

const DEFAULT_ANTHROPIC_MODELS = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
const DEFAULT_OPENAI_IMAGE_MODELS = ['gpt-image-1']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const result: { anthropic: string[]; openai: string[] } = {
    anthropic: DEFAULT_ANTHROPIC_MODELS,
    openai: DEFAULT_OPENAI_IMAGE_MODELS,
  }

  // Fetch live Anthropic model list
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
      })
      const data = await res.json()
      if (Array.isArray(data.data)) {
        const ids: string[] = data.data.map((m: { id: string }) => m.id).filter((id: string) => id.startsWith('claude-'))
        if (ids.length > 0) result.anthropic = ids
      }
    } catch { /* fall back to defaults */ }
  }

  // Fetch live OpenAI model list (filter to image models)
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      })
      const data = await res.json()
      if (Array.isArray(data.data)) {
        const ids: string[] = data.data
          .map((m: { id: string }) => m.id)
          .filter((id: string) => id.includes('image') || id.includes('dall-e'))
        if (ids.length > 0) result.openai = ids
      }
    } catch { /* fall back to defaults */ }
  }

  return Response.json(result)
}
