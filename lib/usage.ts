import type { SupabaseClient } from '@supabase/supabase-js'

// Prices in USD per 1M tokens (or per image for image models)
const PRICING: Record<string, { input: number; output: number; perImage?: number }> = {
  'claude-opus-4-7':           { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':          { input: 0.80,  output: 4.00 },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00 },
  'gpt-image-1':               { input: 0,     output: 0,    perImage: 0.06 },
  'gpt-image-2':               { input: 0,     output: 0,    perImage: 0.06 },
}

export function estimateCost(model: string, inputTokens = 0, outputTokens = 0, imageCount = 0): number {
  const p = PRICING[model]
  if (!p) return 0
  if (p.perImage !== undefined) return imageCount * p.perImage
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

export function logUsage(
  supabase: SupabaseClient,
  userId: string,
  service: 'anthropic' | 'openai',
  model: string,
  feature: string,
  inputTokens?: number,
  outputTokens?: number,
  imageCount?: number,
): void {
  const cost = estimateCost(model, inputTokens ?? 0, outputTokens ?? 0, imageCount ?? 0)
  supabase.from('api_usage_log').insert({
    user_id: userId,
    service,
    model,
    feature,
    input_tokens: inputTokens ?? null,
    output_tokens: outputTokens ?? null,
    image_count: imageCount ?? null,
    estimated_cost_usd: cost,
  }).then(({ error }) => {
    if (error) console.error('[logUsage] insert failed:', error.message, '| code:', error.code, '| feature:', feature)
  })
}
