'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { BrandProfile } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import InspirationRefsSection from './InspirationRefsSection'

const LANGUAGE_OPTIONS = ['Spanish', 'English', 'Danish']

export default function SettingsForm({ initialData }: { initialData: BrandProfile | null }) {
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [form, setForm] = useState({
    business_name: initialData?.business_name ?? '',
    tagline: initialData?.tagline ?? '',
    target_clients: initialData?.target_clients ?? '',
    design_style: initialData?.design_style ?? '',
    services_pricing: initialData?.services_pricing ?? '',
    business_goals: initialData?.business_goals ?? '',
    instagram_handle: initialData?.instagram_handle ?? '',
    website_url: initialData?.website_url ?? '',
    etsy_url: initialData?.etsy_url ?? '',
    logo_url: initialData?.logo_url ?? '',
    languages: initialData?.languages ?? ['Spanish', 'English', 'Danish'],
  })

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (saved) setTheme(saved)
  }, [])

  function toggleTheme(value: 'light' | 'dark') {
    setTheme(value)
    localStorage.setItem('theme', value)
    document.documentElement.classList.toggle('dark', value === 'dark')
  }

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
          <Input label="Website URL" value={form.website_url} onChange={(e) => update('website_url', e.target.value)} placeholder="https://yourstudio.squarespace.com" />
          <Input label="Etsy shop URL" value={form.etsy_url} onChange={(e) => update('etsy_url', e.target.value)} placeholder="https://www.etsy.com/shop/yourstudio" />
          <div>
            <Input
              label="Logo URL"
              value={form.logo_url}
              onChange={(e) => update('logo_url', e.target.value)}
              placeholder="https://yourstudio.com/logo.png"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Paste a direct link to your logo image — it will appear in the sidebar.
            </p>
            {form.logo_url && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.logo_url}
                  alt="Logo preview"
                  className="w-8 h-8 rounded-full object-cover"
                  style={{ border: '1px solid var(--border)' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Preview</span>
              </div>
            )}
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

      <Card>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Appearance</h2>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Theme</label>
          <div className="flex gap-2">
            {(['light', 'dark'] as const).map(t => (
              <button
                key={t}
                onClick={() => toggleTheme(t)}
                className="px-4 py-2 rounded-full text-sm font-medium capitalize transition-all"
                style={{
                  background: theme === t ? 'var(--foreground)' : 'var(--border)',
                  color: theme === t ? 'var(--background)' : 'var(--muted)',
                }}
              >
                {t === 'light' ? '☀ Light' : '☾ Dark'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>Save changes</Button>
      </div>

      <InspirationRefsSection />
    </div>
  )
}
