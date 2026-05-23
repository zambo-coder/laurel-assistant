'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { BrandProfile } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'

const LANGUAGE_OPTIONS = ['Spanish', 'English', 'Danish']

export default function SettingsForm({ initialData }: { initialData: BrandProfile | null }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    business_name: initialData?.business_name ?? '',
    tagline: initialData?.tagline ?? '',
    target_clients: initialData?.target_clients ?? '',
    design_style: initialData?.design_style ?? '',
    services_pricing: initialData?.services_pricing ?? '',
    business_goals: initialData?.business_goals ?? '',
    instagram_handle: initialData?.instagram_handle ?? '',
    languages: initialData?.languages ?? ['Spanish', 'English', 'Danish'],
  })

  function update(field: string, value: string | string[]) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  function toggleLanguage(lang: string) {
    setForm((p) => ({
      ...p,
      languages: p.languages.includes(lang)
        ? p.languages.filter((l) => l !== lang)
        : [...p.languages, lang],
    }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Brand profile saved')
    } catch {
      toast.error('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--foreground)' }}>Your Studio</h2>
        <div className="space-y-4">
          <Input label="Business name" value={form.business_name} onChange={(e) => update('business_name', e.target.value)} />
          <Input label="Tagline" value={form.tagline} onChange={(e) => update('tagline', e.target.value)} placeholder="One line that captures your work" />
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
              Instagram handle
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>@</span>
              <input
                type="text"
                value={form.instagram_handle}
                onChange={(e) => update('instagram_handle', e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Working languages</label>
            <div className="flex gap-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang}
                  onClick={() => toggleLanguage(lang)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: form.languages.includes(lang) ? 'var(--foreground)' : 'var(--border)',
                    color: form.languages.includes(lang) ? 'var(--background)' : 'var(--muted)',
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--foreground)' }}>Clients & Style</h2>
        <div className="space-y-4">
          <Textarea label="Ideal clients" value={form.target_clients} onChange={(e) => update('target_clients', e.target.value)} rows={3} />
          <Textarea label="Design style & tone" value={form.design_style} onChange={(e) => update('design_style', e.target.value)} rows={3} />
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--foreground)' }}>Services & Goals</h2>
        <div className="space-y-4">
          <Textarea label="Services offered & pricing" value={form.services_pricing} onChange={(e) => update('services_pricing', e.target.value)} rows={3} />
          <Textarea label="Current business goals" value={form.business_goals} onChange={(e) => update('business_goals', e.target.value)} rows={3} />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>Save changes</Button>
      </div>
    </div>
  )
}
