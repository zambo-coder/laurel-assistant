'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { BrandProfile, SocialLink } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import InspirationRefsSection from './InspirationRefsSection'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

const LANGUAGE_OPTIONS = ['Spanish', 'English', 'Danish']
const TABS = ['Profile', 'Appearance', 'Inspiration', 'Models', 'Usage'] as const
type Tab = typeof TABS[number]

const PLATFORM_SUGGESTIONS = ['Instagram', 'Website', 'Pinterest', 'TikTok', 'LinkedIn', 'Etsy', 'Facebook', 'YouTube', 'Behance']

const FEATURE_LABELS: Record<string, string> = {
  captions: 'Captions',
  chat: 'AI Assistant',
  calendar_generate: 'Calendar Generate',
  calendar_suggest: 'Calendar Suggest',
  calendar_recommend: 'Calendar Recommend',
  strategy: 'Strategy Advisor',
  presence: 'My Presence',
  opportunities: 'Opportunities',
  campaign: 'Campaign Builder',
  tasks_generate: 'Task Generator',
  mockup: 'Asset Mockup',
}

interface UsageRow {
  id: string
  service: string
  model: string
  feature: string
  input_tokens: number | null
  output_tokens: number | null
  image_count: number | null
  estimated_cost_usd: number | null
  created_at: string
}

function getInitialSocialLinks(brand: BrandProfile | null): SocialLink[] {
  if (brand?.social_links?.length) return brand.social_links
  const links: SocialLink[] = []
  if (brand?.instagram_handle) links.push({ label: 'Instagram', url: `@${brand.instagram_handle}` })
  if (brand?.website_url) links.push({ label: 'Website', url: brand.website_url })
  if (brand?.etsy_url) links.push({ label: 'Etsy', url: brand.etsy_url })
  return links
}

const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all'
const inputStyle = { background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }

export default function SettingsForm({ initialData }: { initialData: BrandProfile | null }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('Profile')
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [form, setForm] = useState({
    business_name: initialData?.business_name ?? '',
    tagline: initialData?.tagline ?? '',
    target_clients: initialData?.target_clients ?? '',
    design_style: initialData?.design_style ?? '',
    services_pricing: initialData?.services_pricing ?? '',
    business_goals: initialData?.business_goals ?? '',
    logo_url: initialData?.logo_url ?? '',
    languages: initialData?.languages ?? ['Spanish', 'English', 'Danish'],
    social_links: getInitialSocialLinks(initialData),
  })

  // Models state
  const [textModels, setTextModels] = useState<string[]>([])
  const [imageModels, setImageModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [selectedTextModel, setSelectedTextModel] = useState(initialData?.ai_text_model ?? '')
  const [selectedImageModel, setSelectedImageModel] = useState(initialData?.ai_image_model ?? '')
  const [savingModels, setSavingModels] = useState(false)

  // Usage state
  const [usageRows, setUsageRows] = useState<UsageRow[]>([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageDays, setUsageDays] = useState(30)

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (saved) setTheme(saved)
  }, [])

  useEffect(() => {
    if (activeTab === 'Models' && textModels.length === 0) loadModels()
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'Usage') loadUsage()
  }, [activeTab, usageDays])

  async function loadModels() {
    setModelsLoading(true)
    try {
      const res = await fetch('/api/settings/models')
      if (res.ok) {
        const data = await res.json()
        setTextModels(data.anthropic ?? [])
        setImageModels(data.openai ?? [])
      }
    } catch { /* silent */ }
    finally { setModelsLoading(false) }
  }

  async function loadUsage() {
    setUsageLoading(true)
    try {
      const res = await fetch(`/api/settings/usage?days=${usageDays}`)
      if (res.ok) setUsageRows(await res.json())
    } catch { /* silent */ }
    finally { setUsageLoading(false) }
  }

  async function saveModels() {
    setSavingModels(true)
    try {
      const res = await fetch('/api/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_text_model: selectedTextModel || null, ai_image_model: selectedImageModel || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Model preferences saved')
    } catch {
      toast.error('Could not save preferences')
    } finally {
      setSavingModels(false)
    }
  }

  function toggleTheme(value: 'light' | 'dark') {
    setTheme(value)
    localStorage.setItem('theme', value)
    document.documentElement.classList.toggle('dark', value === 'dark')
  }

  function update(field: string, value: string | string[]) {
    setForm(p => ({ ...p, [field]: value }))
  }

  function toggleLanguage(lang: string) {
    setForm(p => ({
      ...p,
      languages: p.languages.includes(lang)
        ? p.languages.filter(l => l !== lang)
        : [...p.languages, lang],
    }))
  }

  function addLink() {
    setForm(p => ({ ...p, social_links: [...p.social_links, { label: '', url: '' }] }))
  }

  function updateLink(i: number, field: 'label' | 'url', value: string) {
    setForm(p => {
      const links = [...p.social_links]
      links[i] = { ...links[i], [field]: value }
      return { ...p, social_links: links }
    })
  }

  function removeLink(i: number) {
    setForm(p => ({ ...p, social_links: p.social_links.filter((_, idx) => idx !== i) }))
  }

  async function save() {
    setSaving(true)
    try {
      const websiteLink = form.social_links.find(l => l.label.toLowerCase() === 'website')
      const instagramLink = form.social_links.find(l => l.label.toLowerCase() === 'instagram')

      const body = {
        ...form,
        website_url: websiteLink?.url ?? '',
        instagram_handle: instagramLink?.url?.replace(/^@/, '') ?? '',
      }

      const res = await fetch('/api/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Saved')
      router.refresh()
    } catch {
      toast.error('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ---- Usage helpers ----

  const totalCost = usageRows.reduce((s, r) => s + (r.estimated_cost_usd ?? 0), 0)

  const chartData = (() => {
    const byDay: Record<string, number> = {}
    for (const row of usageRows) {
      const day = row.created_at.slice(0, 10)
      byDay[day] = (byDay[day] ?? 0) + (row.estimated_cost_usd ?? 0)
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cost]) => ({ date: date.slice(5), cost: +cost.toFixed(4) }))
  })()

  const byFeature = (() => {
    const map: Record<string, { model: string; calls: number; cost: number }> = {}
    for (const row of usageRows) {
      const key = row.feature
      if (!map[key]) map[key] = { model: row.model, calls: 0, cost: 0 }
      map[key].calls++
      map[key].cost += row.estimated_cost_usd ?? 0
    }
    return Object.entries(map)
      .map(([feature, v]) => ({ feature, ...v }))
      .sort((a, b) => b.cost - a.cost)
  })()

  return (
    <div className="max-w-2xl">
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl flex-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={{
              background: activeTab === tab ? 'var(--foreground)' : 'transparent',
              color: activeTab === tab ? 'var(--background)' : 'var(--muted)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === 'Profile' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--foreground)' }}>Your Studio</h2>
            <div className="space-y-4">
              <Input label="Business name" value={form.business_name} onChange={e => update('business_name', e.target.value)} />
              <Input label="Tagline" value={form.tagline} onChange={e => update('tagline', e.target.value)} placeholder="One line that captures your work" />
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Working languages</label>
                <div className="flex gap-2">
                  {LANGUAGE_OPTIONS.map(lang => (
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
            <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Online profiles</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Add any profiles or pages — website, social media, portfolio, etc.</p>
            <div className="space-y-2">
              {form.social_links.map((link, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="relative w-32 shrink-0">
                    <input
                      list={`platforms-${i}`}
                      value={link.label}
                      onChange={e => updateLink(i, 'label', e.target.value)}
                      placeholder="Platform"
                      className={inputClass}
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                    />
                    <datalist id={`platforms-${i}`}>
                      {PLATFORM_SUGGESTIONS.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <input
                    value={link.url}
                    onChange={e => updateLink(i, 'url', e.target.value)}
                    placeholder="URL or @handle"
                    className={`${inputClass} flex-1`}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                  <button
                    onClick={() => removeLink(i)}
                    className="text-lg leading-none hover:opacity-60 transition-opacity shrink-0 w-7 text-center"
                    style={{ color: 'var(--muted)' }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={addLink}
                className="text-xs mt-1 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--muted)' }}
              >
                + Add profile
              </button>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--foreground)' }}>Clients & Style</h2>
            <div className="space-y-4">
              <Textarea label="Ideal clients" value={form.target_clients} onChange={e => update('target_clients', e.target.value)} rows={3} />
              <Textarea label="Design style & tone" value={form.design_style} onChange={e => update('design_style', e.target.value)} rows={3} />
            </div>
          </Card>

          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Services & Goals</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Managed in the Strategy section</p>
            </div>
            <a
              href="/strategy"
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
              style={{ background: 'var(--foreground)', color: 'var(--background)' }}
            >
              Open Strategy →
            </a>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>Save changes</Button>
          </div>
        </div>
      )}

      {/* Appearance tab */}
      {activeTab === 'Appearance' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--foreground)' }}>Logo</h2>
            <div className="space-y-3">
              <Input
                label="Logo URL"
                value={form.logo_url}
                onChange={e => update('logo_url', e.target.value)}
                placeholder="https://yourstudio.com/logo.png"
              />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Paste a direct link to your logo image — it will appear in the sidebar.
              </p>
              {form.logo_url && (
                <div className="flex items-center gap-2 mt-2">
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
          </Card>

          <Card>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Theme</h2>
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
          </Card>

          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>Save changes</Button>
          </div>
        </div>
      )}

      {/* Inspiration tab */}
      {activeTab === 'Inspiration' && (
        <InspirationRefsSection />
      )}

      {/* Models tab */}
      {activeTab === 'Models' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>AI Models</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
              Choose which model powers each AI feature. Changes apply on the next request.
            </p>

            {modelsLoading ? (
              <p className="text-sm py-4" style={{ color: 'var(--muted)' }}>Loading available models…</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Text AI (Anthropic)
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                    Used for chat, captions, calendar, strategy, and all other text features.
                  </p>
                  <select
                    value={selectedTextModel}
                    onChange={e => setSelectedTextModel(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="">Default (claude-sonnet-4-6)</option>
                    {textModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Image AI (OpenAI)
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                    Used for AI mockup generation in the Asset Library.
                  </p>
                  <select
                    value={selectedImageModel}
                    onChange={e => setSelectedImageModel(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="">Default (gpt-image-1)</option>
                    {imageModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={loadModels}
                    className="text-xs hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--muted)' }}
                  >
                    Refresh model list
                  </button>
                  <Button onClick={saveModels} loading={savingModels}>Save preferences</Button>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Approximate pricing</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ color: 'var(--muted)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-2 pr-4 font-medium">Model</th>
                    <th className="text-right py-2 pr-4 font-medium">Input / 1M tokens</th>
                    <th className="text-right py-2 font-medium">Output / 1M tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { model: 'claude-opus-4-7', input: '$15.00', output: '$75.00' },
                    { model: 'claude-sonnet-4-6', input: '$3.00', output: '$15.00' },
                    { model: 'claude-haiku-4-5', input: '$0.80', output: '$4.00' },
                    { model: 'gpt-image-1', input: '—', output: '~$0.06 / image' },
                  ].map(row => (
                    <tr key={row.model} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2 pr-4 font-mono">{row.model}</td>
                      <td className="py-2 pr-4 text-right">{row.input}</td>
                      <td className="py-2 text-right">{row.output}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
              Estimates only — check Anthropic and OpenAI dashboards for billing.
            </p>
          </Card>
        </div>
      )}

      {/* Usage tab */}
      {activeTab === 'Usage' && (
        <div className="space-y-6">
          {/* Period selector */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>API Usage</h2>
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setUsageDays(d)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: usageDays === d ? 'var(--foreground)' : 'transparent',
                    color: usageDays === d ? 'var(--background)' : 'var(--muted)',
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {usageLoading ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>Loading usage data…</p>
          ) : usageRows.length === 0 ? (
            <Card>
              <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>
                No usage recorded in the last {usageDays} days. Start using AI features and costs will appear here.
              </p>
            </Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total estimated cost', value: `$${totalCost.toFixed(4)}` },
                  { label: 'Total requests', value: usageRows.length.toString() },
                  {
                    label: 'Most used feature',
                    value: (() => {
                      const counts: Record<string, number> = {}
                      for (const r of usageRows) counts[r.feature] = (counts[r.feature] ?? 0) + 1
                      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
                      return top ? (FEATURE_LABELS[top[0]] ?? top[0]) : '—'
                    })(),
                  },
                ].map(card => (
                  <div
                    key={card.label}
                    className="rounded-xl p-4"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{card.label}</p>
                    <p className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Cost over time chart */}
              {chartData.length > 1 && (
                <Card>
                  <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--foreground)' }}>Cost over time (USD)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'var(--muted)' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--muted)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => `$${v}`}
                      />
                      <Tooltip
                        formatter={(value) => [`$${Number(value ?? 0).toFixed(4)}`, 'Cost']}
                        contentStyle={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'var(--foreground)',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Breakdown by feature */}
              <Card>
                <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--foreground)' }}>Breakdown by feature</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left py-2 pr-4 text-xs font-medium" style={{ color: 'var(--muted)' }}>Feature</th>
                        <th className="text-left py-2 pr-4 text-xs font-medium" style={{ color: 'var(--muted)' }}>Model</th>
                        <th className="text-right py-2 pr-4 text-xs font-medium" style={{ color: 'var(--muted)' }}>Requests</th>
                        <th className="text-right py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>Est. cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byFeature.map(row => (
                        <tr key={row.feature} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="py-2 pr-4" style={{ color: 'var(--foreground)' }}>
                            {FEATURE_LABELS[row.feature] ?? row.feature}
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                            {row.model}
                          </td>
                          <td className="py-2 pr-4 text-right" style={{ color: 'var(--muted)' }}>{row.calls}</td>
                          <td className="py-2 text-right" style={{ color: 'var(--foreground)' }}>
                            ${row.cost.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
