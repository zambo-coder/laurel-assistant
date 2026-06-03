'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import TagInput from '@/components/ui/TagInput'
import { InspirationRef } from '@/types'

const PLATFORMS = ['instagram', 'website', 'etsy', 'pinterest', 'other'] as const

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

export default function InspirationRefsSection() {
  const [refs, setRefs] = useState<InspirationRef[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    fetch('/api/inspiration')
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setRefs(data) : setRefs([]))
      .finally(() => setLoading(false))
  }, [])

  // All existing tags across all refs — offered as suggestions
  const allTags = [...new Set(refs.flatMap(r => r.aspect_tags))]

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
    } catch { /* silently fail */ }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    await fetch(`/api/inspiration?id=${id}`, { method: 'DELETE' })
    setRefs(p => p.filter(r => r.id !== id))
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Inspiration references</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Accounts and pages she admires — the AI uses these to shape all content</p>
        </div>
        <Button onClick={() => setShowForm(p => !p)} variant="secondary" size="sm">
          {showForm ? 'Cancel' : '+ Add'}
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-5 p-4 rounded-lg space-y-4" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-3">
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
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              What inspires you? <span className="font-normal text-xs" style={{ color: 'var(--muted)' }}>— type any tag, Enter to add</span>
            </label>
            <TagInput
              tags={form.aspect_tags}
              onChange={tags => setForm(p => ({ ...p, aspect_tags: tags }))}
              suggestions={allTags}
              placeholder="e.g. photography, pricing, branding…"
            />
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="What specifically do you love? Any details the AI should know..."
            rows={2}
          />

          <div className="flex justify-end">
            <Button onClick={save} loading={saving} disabled={!form.name.trim()} size="sm">
              Save reference
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : refs.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          No references yet. Add accounts or pages you admire and the AI will use them to shape captions, calendar ideas, and strategy.
        </p>
      ) : (
        <ul className="space-y-3">
          {refs.map(ref => (
            <li key={ref.id} className="flex items-start gap-3 py-2 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
              <span className="text-base mt-0.5 shrink-0">{PLATFORM_ICONS[ref.platform] ?? '◈'}</span>
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
                    className="text-xs shrink-0 hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--muted)' }}
                  >
                    Remove
                  </button>
                </div>
                {ref.aspect_tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {ref.aspect_tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: 'var(--accent)', color: '#fff', opacity: 0.85 }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {ref.notes && (
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>{ref.notes}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
