'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const nav = [
  {
    label: null,
    items: [{ href: '/dashboard', icon: '◈', label: 'Dashboard' }],
  },
  {
    label: 'Social Media',
    items: [
      { href: '/captions', icon: '✦', label: 'Captions' },
      { href: '/calendar', icon: '◻', label: 'Content Calendar' },
      { href: '/campaign', icon: '◇', label: 'Campaigns' },
      { href: '/inspiration', icon: '✶', label: 'Inspiration' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { href: '/inquiries', icon: '✉', label: 'Client Inquiries' },
      { href: '/website-copy', icon: '◑', label: 'Website Copy' },
      { href: '/assets', icon: '⊞', label: 'Asset Library' },
      { href: '/presence', icon: '◉', label: 'My Presence' },
    ],
  },
  {
    label: 'Strategy',
    items: [
      { href: '/opportunities', icon: '◆', label: 'Opportunities' },
      { href: '/roi', icon: '◎', label: 'ROI Tracker' },
      { href: '/strategy', icon: '◈', label: 'Strategy Advisor' },
    ],
  },
]

export default function Sidebar({ brandName }: { brandName?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className="flex flex-col w-56 shrink-0 h-screen sticky top-0 overflow-y-auto py-6 px-3"
      style={{ background: '#ffffff', borderRight: '1px solid var(--border)' }}
    >
      {/* Brand mark */}
      <div className="px-3 mb-7">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 uppercase"
            style={{ background: 'var(--foreground)', color: 'var(--background)' }}
          >
            {brandName ? brandName.charAt(0) : '✦'}
          </div>
          <div>
            <div className="text-sm font-semibold leading-none truncate max-w-[120px]" style={{ color: 'var(--foreground)' }}>
              {brandName || 'Studio'}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              AI Assistant
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5">
        {nav.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--muted)' }}>
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
                      style={{
                        background: active ? 'var(--cream-200, #f4efe6)' : 'transparent',
                        color: active ? 'var(--foreground)' : 'var(--stone-500, #7c6e5e)',
                        fontWeight: active ? '500' : '400',
                      }}
                    >
                      <span className="text-base w-4 text-center shrink-0">{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Settings + Sign out */}
      <div className="mt-6 px-3 space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
          style={{
            background: pathname === '/settings' ? 'var(--cream-200, #f4efe6)' : 'transparent',
            color: pathname === '/settings' ? 'var(--foreground)' : 'var(--stone-500, #7c6e5e)',
            fontWeight: pathname === '/settings' ? '500' : '400',
          }}
        >
          <span className="text-base w-4 text-center shrink-0">⚙</span>
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full text-left text-xs px-3 py-2 transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted)' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
