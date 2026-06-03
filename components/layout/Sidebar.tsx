'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const navSections = [
  {
    label: 'Planning',
    defaultOpen: true,
    items: [
      { href: '/strategy', icon: '◎', label: 'Strategy' },
      { href: '/tasks', icon: '◻', label: 'Tasks' },
      { href: '/schedule', icon: '◉', label: 'Schedule' },
    ],
  },
  {
    label: 'AI Assistant',
    defaultOpen: true,
    items: [
      { href: '/chat', icon: '✦', label: 'Chat' },
      { href: '/captions', icon: '◈', label: 'Captions' },
      { href: '/calendar', icon: '◻', label: 'Content Calendar' },
      { href: '/campaign', icon: '◇', label: 'Campaigns' },
      { href: '/website-copy', icon: '◑', label: 'Website Copy' },
      { href: '/presence', icon: '◉', label: 'My Presence' },
    ],
  },
  {
    label: 'Business',
    defaultOpen: false,
    items: [
      { href: '/inquiries', icon: '✉', label: 'Client Inquiries' },
      { href: '/roi', icon: '◇', label: 'ROI Tracker' },
      { href: '/assets', icon: '⊞', label: 'Asset Library' },
    ],
  },
]

const STORAGE_KEY = 'sidebar_sections'

export default function Sidebar({ brandName, logoUrl }: { brandName?: string; logoUrl?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const defaults: Record<string, boolean> = {}
  navSections.forEach(s => { defaults[s.label] = s.defaultOpen })

  const [expanded, setExpanded] = useState<Record<string, boolean>>(defaults)

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setExpanded(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // Auto-expand section when navigating into it
  useEffect(() => {
    navSections.forEach(section => {
      const hasActive = section.items.some(item => pathname.startsWith(item.href))
      if (hasActive) {
        setExpanded(prev => {
          if (prev[section.label]) return prev
          const next = { ...prev, [section.label]: true }
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
          return next
        })
      }
    })
  }, [pathname])

  function toggleSection(label: string) {
    setExpanded(prev => {
      const next = { ...prev, [label]: !prev[label] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = brandName ? `${brandName} Assistant` : 'Studio Assistant'

  return (
    <aside
      className="flex flex-col w-56 shrink-0 h-screen sticky top-0 overflow-y-auto py-6 px-3"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Brand mark */}
      <div className="px-3 mb-7">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-xs font-semibold uppercase"
            style={{ background: 'var(--foreground)', color: 'var(--background)' }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="logo" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              brandName ? brandName.charAt(0) : '✦'
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--foreground)' }}>
              {displayName}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard — always visible */}
      <div className="mb-4 space-y-0.5">
        {(() => {
          const active = pathname === '/dashboard'
          return (
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
              style={{
                background: active ? 'var(--sidebar-active)' : 'transparent',
                color: active ? 'var(--foreground)' : 'var(--stone-500, #7c6e5e)',
                fontWeight: active ? '500' : '400',
              }}
            >
              <span className="text-base w-4 text-center shrink-0">◈</span>
              Dashboard
            </Link>
          )
        })()}
      </div>

      {/* Collapsible sections */}
      <nav className="flex-1 space-y-3">
        {navSections.map(section => {
          const isOpen = expanded[section.label] ?? section.defaultOpen
          const hasActiveChild = section.items.some(item => pathname.startsWith(item.href))

          return (
            <div key={section.label}>
              <button
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between px-3 py-1 mb-0.5 transition-opacity hover:opacity-70"
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: hasActiveChild && !isOpen ? 'var(--accent)' : 'var(--muted)' }}
                >
                  {section.label}
                </span>
                <span className="text-[9px]" style={{ color: 'var(--muted)' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {isOpen && (
                <ul className="space-y-0.5">
                  {section.items.map(item => {
                    const active = pathname === item.href || pathname.startsWith(item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
                          style={{
                            background: active ? 'var(--sidebar-active)' : 'transparent',
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
              )}
            </div>
          )
        })}
      </nav>

      {/* Settings + Sign out */}
      <div className="mt-6 px-3 space-y-0.5">
        {(() => {
          const active = pathname === '/settings'
          return (
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
              style={{
                background: active ? 'var(--sidebar-active)' : 'transparent',
                color: active ? 'var(--foreground)' : 'var(--stone-500, #7c6e5e)',
                fontWeight: active ? '500' : '400',
              }}
            >
              <span className="text-base w-4 text-center shrink-0">⚙</span>
              Settings
            </Link>
          )
        })()}
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
