import { createClient } from '@/lib/supabase/server'
import Card from '@/components/ui/Card'
import DashboardChat from '@/components/dashboard/DashboardChat'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: brand }, { data: recentCaptions }, { data: recentInquiries }] = await Promise.all([
    supabase.from('brand_profile').select('*').single(),
    supabase.from('caption_history').select('id, prompt, created_at').order('created_at', { ascending: false }).limit(3),
    supabase.from('client_inquiries').select('id, inquiry, created_at').order('created_at', { ascending: false }).limit(3),
  ])

  const greeting = getGreeting()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>{greeting}</p>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
          {brand?.business_name ?? 'Your Studio'}
        </h1>
        {brand?.tagline && (
          <p className="mt-1 text-sm italic" style={{ color: 'var(--muted)' }}>{brand.tagline}</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { href: '/captions', icon: '✦', label: 'Generate caption', sub: 'Social Media' },
          { href: '/inquiries', icon: '✉', label: 'Handle inquiry', sub: 'Commercial' },
          { href: '/strategy', icon: '◈', label: 'Plan strategy', sub: 'Strategy' },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-sm transition-shadow cursor-pointer group">
              <div className="text-xl mb-3">{item.icon}</div>
              <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{item.sub}</div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main: AI Chat + Recent activity */}
      <div className="grid grid-cols-5 gap-6">
        {/* AI Chat */}
        <div className="col-span-3">
          <Card padding="sm">
            <div className="px-2 pt-2 pb-1 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#7a9478' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>AI Assistant</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>Knows your brand</span>
            </div>
            <DashboardChat brand={brand} />
          </Card>
        </div>

        {/* Right column */}
        <div className="col-span-2 space-y-4">
          {/* Website card */}
          {brand?.website_url && (
            <Card padding="sm">
              <div className="px-2 pt-2 pb-1 mb-3">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Website</p>
              </div>
              <div className="px-2 space-y-2 pb-2">
                <a
                  href={brand.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--foreground)' }}
                >
                  <span>◑</span>
                  <span className="underline underline-offset-2 truncate">{brand.website_url.replace(/^https?:\/\//, '')}</span>
                </a>
                <a
                  href="https://account.squarespace.com/analytics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--muted)' }}
                >
                  <span>◎</span>
                  <span className="underline underline-offset-2">Squarespace Analytics →</span>
                </a>
              </div>
            </Card>
          )}

          {/* Recent captions */}
          <Card padding="sm">
            <div className="px-2 pt-2 pb-1 mb-3">
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Recent captions</p>
            </div>
            {recentCaptions && recentCaptions.length > 0 ? (
              <ul className="space-y-2 px-2">
                {recentCaptions.map((c) => (
                  <li key={c.id}>
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--foreground)' }}>
                      {c.prompt}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs px-2 pb-2" style={{ color: 'var(--muted)' }}>No captions yet</p>
            )}
            <div className="px-2 pb-2 mt-3">
              <Link href="/captions" className="text-xs underline underline-offset-2" style={{ color: 'var(--muted)' }}>
                View all →
              </Link>
            </div>
          </Card>

          {/* Recent inquiries */}
          <Card padding="sm">
            <div className="px-2 pt-2 pb-1 mb-3">
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Recent inquiries</p>
            </div>
            {recentInquiries && recentInquiries.length > 0 ? (
              <ul className="space-y-2 px-2">
                {recentInquiries.map((c) => (
                  <li key={c.id}>
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--foreground)' }}>
                      {c.inquiry}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs px-2 pb-2" style={{ color: 'var(--muted)' }}>No inquiries yet</p>
            )}
            <div className="px-2 pb-2 mt-3">
              <Link href="/inquiries" className="text-xs underline underline-offset-2" style={{ color: 'var(--muted)' }}>
                View all →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
