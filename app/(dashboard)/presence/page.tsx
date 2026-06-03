import { createClient } from '@/lib/supabase/server'
import PresenceClient from './PresenceClient'
import { SocialLink } from '@/types'

interface PageEntry { url: string; platform: string; label: string }

export default async function PresencePage() {
  const supabase = await createClient()

  const [{ data: brand }, { data: analyses }] = await Promise.all([
    supabase.from('brand_profile').select('instagram_handle, website_url, etsy_url, social_links').single(),
    supabase.from('presence_analysis').select('*').order('analyzed_at', { ascending: false }),
  ])

  const pages: PageEntry[] = []
  const socialLinks = (brand?.social_links ?? []) as SocialLink[]

  if (socialLinks.length > 0) {
    for (const link of socialLinks) {
      let url = (link.url ?? '').trim()
      const label = link.label ?? ''
      const platform = label.toLowerCase()
      if (platform === 'instagram' && url.startsWith('@')) {
        url = `https://instagram.com/${url.slice(1)}`
      }
      if (url.startsWith('http')) pages.push({ url, platform, label })
    }
  } else {
    // Fall back to legacy fields
    if (brand?.website_url) pages.push({ url: brand.website_url, platform: 'website', label: 'Website' })
    if (brand?.instagram_handle) pages.push({ url: `https://instagram.com/${brand.instagram_handle}`, platform: 'instagram', label: `@${brand.instagram_handle}` })
  }

  const safeAnalyses = (analyses ?? []).filter(Boolean)

  return <PresenceClient pages={pages} initialAnalyses={safeAnalyses} />
}
