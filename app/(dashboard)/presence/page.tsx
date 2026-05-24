import { createClient } from '@/lib/supabase/server'
import PresenceClient from './PresenceClient'

export default async function PresencePage() {
  const supabase = await createClient()

  const [{ data: brand }, { data: analyses }] = await Promise.all([
    supabase.from('brand_profile').select('instagram_handle, website_url, etsy_url').single(),
    supabase.from('presence_analysis').select('*').order('analyzed_at', { ascending: false }),
  ])

  const pages = [
    brand?.website_url ? { url: brand.website_url, platform: 'website', label: 'Website' } : null,
    brand?.instagram_handle ? { url: `https://instagram.com/${brand.instagram_handle}`, platform: 'instagram', label: `@${brand.instagram_handle}` } : null,
    (brand as { etsy_url?: string } | null)?.etsy_url ? { url: (brand as { etsy_url?: string }).etsy_url!, platform: 'etsy', label: 'Etsy Shop' } : null,
  ].filter(Boolean) as { url: string; platform: string; label: string }[]

  return <PresenceClient pages={pages} initialAnalyses={analyses ?? []} />
}
