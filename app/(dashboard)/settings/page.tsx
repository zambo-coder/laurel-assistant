import { createClient } from '@/lib/supabase/server'
import SettingsForm from '@/components/settings/SettingsForm'
import PageHeader from '@/components/ui/PageHeader'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: brand } = await supabase.from('brand_profile').select('*').single()

  return (
    <div>
      <PageHeader title="Settings" description="Edit your brand profile — this shapes everything the AI creates" />
      <SettingsForm initialData={brand} />
    </div>
  )
}
