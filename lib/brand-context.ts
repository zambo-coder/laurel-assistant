import { BrandProfile, InspirationRef } from '@/types'

export function buildBrandSystemPrompt(brand: BrandProfile, refs?: InspirationRef[]): string {
  const languageList = brand.languages?.join(', ') || 'Spanish, English, Danish'

  const profileLines: string[] = []
  if (brand.social_links?.length) {
    brand.social_links.forEach(l => profileLines.push(`${l.label}: ${l.url}`))
  } else if (brand.instagram_handle) {
    profileLines.push(`Instagram: @${brand.instagram_handle}`)
  }
  if (brand.website_url && !profileLines.some(l => l.toLowerCase().includes('website'))) {
    profileLines.push(`Website: ${brand.website_url}`)
  }

  let prompt = `You are a creative business assistant for ${brand.business_name}, a boutique wedding invitation design studio.

BRAND IDENTITY:
- Business: ${brand.business_name}
- Tagline: ${brand.tagline}
- Target clients: ${brand.target_clients}
- Design style & tone: ${brand.design_style}
- Services & pricing: ${brand.services_pricing}
- Current business goals: ${brand.business_goals}${profileLines.length ? `\n- Online profiles: ${profileLines.join(', ')}` : ''}
- Working languages: ${languageList}

VOICE & TONE GUIDELINES:
- Write in the voice of ${brand.business_name} — warm, elegant, personal, and artistic
- Avoid corporate or generic language
- Reflect a Colombian designer's warmth and creativity, based in Copenhagen, Denmark
- The studio is boutique and bespoke — never mass-market
- When writing in Spanish, use natural Latin American Spanish (Colombian warmth)
- When writing in Danish, use simple, clean Scandinavian style
- When writing in English, blend warmth with Nordic elegance

Always generate output that feels authentically like ${brand.business_name}, not like a generic AI assistant.`

  if (refs && refs.length > 0) {
    const refLines = refs.map(r => {
      const aspects = r.aspect_tags.length > 0 ? r.aspect_tags.join(', ') : 'general style'
      const note = r.notes ? ` Notes: ${r.notes}` : ''
      const url = r.url ? ` (${r.url})` : ''
      return `- ${r.name}${url} [${r.platform}] — admired for: ${aspects}.${note}`
    }).join('\n')
    prompt += `\n\nINSPIRATION REFERENCES (accounts/pages she admires — let these inform style, tone, and ideas):\n${refLines}`
  }

  return prompt
}
