'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const LANGUAGE_OPTIONS = ['Spanish', 'English', 'Danish']

export default function OnboardingPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    business_name: '',
    tagline: '',
    target_clients: '',
    design_style: '',
    services_pricing: '',
    business_goals: '',
    instagram_handle: '',
    languages: ['Spanish', 'English', 'Danish'] as string[],
  })

  function update(field: string, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleLanguage(lang: string) {
    setForm((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('brand_profile').upsert({
      user_id: user.id,
      ...form,
      updated_at: new Date().toISOString(),
    })

    if (!error) {
      router.push('/captions')
    } else {
      alert('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  const steps = [
    {
      title: 'Your Studio',
      fields: (
        <div className="space-y-5">
          <Field label="Business name" required>
            <Input value={form.business_name} onChange={(v) => update('business_name', v)} placeholder="e.g. Laurel Studio" />
          </Field>
          <Field label="Tagline">
            <Input value={form.tagline} onChange={(v) => update('tagline', v)} placeholder="e.g. Handcrafted wedding stationery with soul" />
          </Field>
          <Field label="Instagram handle">
            <div className="flex items-center gap-1">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>@</span>
              <Input value={form.instagram_handle} onChange={(v) => update('instagram_handle', v)} placeholder="yourstudio" />
            </div>
          </Field>
          <Field label="Working languages">
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
          </Field>
        </div>
      ),
    },
    {
      title: 'Your Clients & Style',
      fields: (
        <div className="space-y-5">
          <Field label="Who are your ideal clients?" required>
            <Textarea
              value={form.target_clients}
              onChange={(v) => update('target_clients', v)}
              placeholder="e.g. Modern couples who appreciate artisanal craftsmanship. Often international, design-conscious, planning intimate weddings in Scandinavia or Colombia."
              rows={3}
            />
          </Field>
          <Field label="Your design style & tone" required>
            <Textarea
              value={form.design_style}
              onChange={(v) => update('design_style', v)}
              placeholder="e.g. Romantic minimalism. Warm, organic textures. Hand-lettered details. Elegant without being cold. Think: wildflowers, linen, golden hour."
              rows={3}
            />
          </Field>
        </div>
      ),
    },
    {
      title: 'Services & Goals',
      fields: (
        <div className="space-y-5">
          <Field label="Services offered & rough pricing" required>
            <Textarea
              value={form.services_pricing}
              onChange={(v) => update('services_pricing', v)}
              placeholder="e.g. Full invitation suite (save the date, invitation, RSVP, details card): from €800. Day-of stationery: from €300. Digital invitations: from €200."
              rows={3}
            />
          </Field>
          <Field label="Current business goals">
            <Textarea
              value={form.business_goals}
              onChange={(v) => update('business_goals', v)}
              placeholder="e.g. Grow Instagram to 5K followers by end of year. Land 3 destination wedding clients. Build a waiting list for 2026 season."
              rows={3}
            />
          </Field>
        </div>
      ),
    },
  ]

  const currentStep = steps[step]
  const isLast = step === steps.length - 1
  const canNext = step === 0
    ? form.business_name.trim() !== ''
    : step === 1
      ? form.target_clients.trim() !== '' && form.design_style.trim() !== ''
      : form.services_pricing.trim() !== ''

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#fdf8f0', border: '1.5px solid #e8dfd0' }}>
            <span className="text-xl">✦</span>
          </div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Let's set up your studio
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            This shapes everything your co-pilot creates for you
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {steps.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full transition-all"
              style={{ background: i <= step ? 'var(--foreground)' : 'var(--border)' }} />
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: '#ffffff', border: '1px solid var(--border)' }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--foreground)' }}>
            {currentStep.title}
          </h2>
          {currentStep.fields}

          <div className="flex justify-between items-center mt-8">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="text-sm px-4 py-2 rounded-lg transition-all disabled:invisible"
              style={{ color: 'var(--muted)' }}
            >
              ← Back
            </button>
            <button
              onClick={() => isLast ? handleSave() : setStep((s) => s + 1)}
              disabled={!canNext || saving}
              className="px-6 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: 'var(--foreground)', color: '#faf8f4' }}
            >
              {saving ? 'Saving…' : isLast ? 'Launch my co-pilot →' : 'Continue →'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
          You can edit all of this anytime in Settings
        </p>
      </div>
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
        {label} {required && <span style={{ color: 'var(--accent)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
      style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
      onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
      onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
      style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
      onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
      onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
    />
  )
}
