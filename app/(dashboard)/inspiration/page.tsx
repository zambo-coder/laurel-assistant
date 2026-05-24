'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import PageHeader from '@/components/ui/PageHeader'
import { InspirationRef } from '@/types'

const PLATFORMS = ['instagram', 'website', 'etsy', 'pinterest', 'other'] as const
const ASPECT_OPTIONS = [
  { id: 'design_style', label: 'Design Style' },
  { id: 'content', label: 'Content Strategy' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'branding', label: 'Branding' },
  { id: 'photography', label: 'Photography' },
]

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '◎',
  website: '◑',
  etsy: '◇',
  pinterest: '✦',
  other: '◈',
}

const emptyForm = {
  name: '',
  url: '',
  platform: 'instagram' as InspirationRef['platform'],
  aspect_tags: [] as string[],
  notes: '',
}

export default function InspirationPage() {
  const [refs, setRefs] = useState<InspirationRef[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    fetch('/api/inspiration')
      .then(r => r.json())
      .then(data => setRefs(data))
      .finally(() => setLoading(false))
  }, [])

  function toggleTag(id: string) {
    setForm(p => ({
      ...p,
      aspect_tags: p.aspect_tags.includes(id) ? p.aspect_tags.filter(t => t !== id) : [...p.aspect_tags, id],
    }))
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/inspiration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      const created: InspirationRef = await res.json()
      setRefs(p => [created, ...p])
      setForm(emptyForm)
      setShowForm(false)
    } catch {
      // silently fail for now
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    await fetch(`/api/inspiration?id=${id}`, { method: 'DELETE' })
    setRefs(p => p.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inspiration"
        description="Accounts and pages that inspire you. The AI uses these to shape captions, calendar ideas, and strategy."
        action={
          <Button onClick={() => setShowForm(p => !p)} variant={showForm ? 'secondary' : 'primary'}>
            {showForm ? 'Cancel' : '+ Add reference'}
          </Button>
        }
      />

      {/* Add form */}
      {showForm && (
        <Card>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>New inspiration reference</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Name"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Studio Papier, etc."
              />
              <Input
                label="URL (optional)"
                value={form.url}
                onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Platform</label>
              <div className="flex gap-2 flex-wrap">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    onClick={() => setForm(prev => ({ ...prev, platform: p }))}
                    className="px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all"
                    style={{
                      background: form.platform === p ? 'var(--foreground)' : 'var(--border)',
                      color: form.platform === p ? 'var(--background)' : 'var(--muted)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>What inspires you about them?</label>
              <div className="flex gap-2 flex-wrap">
                {ASPECT_OPTIONS.map(a => (
                  <button
                    key={a.id}
                    onClick={() => toggleTag(a.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: form.aspect_tags.includes(a.id) ? 'var(--accent)' : 'var(--border)',
                      color: form.aspect_tags.includes(a.id) ? '#fff' : 'var(--muted)',
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              label="Notes"
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="What specifically do you love? Any details the AI should know..."
              rows={3}
            />

            <div className="flex justify-end">
              <Button onClick={save} loading={saving} disabled={!form.name.trim()}>Save reference</Button>
            </div>
          </div>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : refs.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Add accounts or pages that inspire you — the AI will use these to shape its suggestions.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {refs.map(ref => (
            <Card key={ref.id} padding="sm">
              <div className="flex items-start gap-3 px-2 pt-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
                  style={{ background: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {PLATFORM_ICONS[ref.platform] ?? '◈'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{ref.name}</p>
                      {ref.url && (
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline underline-offset-2 hover:opacity-70 transition-opacity truncate block"
                          style={{ color: 'var(--muted)' }}
                        >
                          {ref.url.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => remove(ref.id)}
                      className="text-xs shrink-0 hover:opacity-70 transition-opacity mt-0.5"
                      style={{ color: 'var(--muted)' }}
                    >
                      Remove
                    </button>
                  </div>

                  {ref.aspect_tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {ref.aspect_tags.map(tag => {
                        const label = ASPECT_OPTIONS.find(a => a.id === tag)?.label ?? tag
                        return (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: 'var(--accent)', color: '#fff', opacity: 0.85 }}
                          >
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {ref.notes && (
                    <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>{ref.notes}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
