import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: brand } = await supabase
    .from('brand_profile')
    .select('id')
    .single()

  if (!brand) redirect('/onboarding')

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
