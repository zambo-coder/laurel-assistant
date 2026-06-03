'use client'

import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import toast from 'react-hot-toast'
import { Goal, FocusArea, OpportunityItem, BrandProfile } from '@/types'

// ── colour helpers ────────────────────────────────────────────────────────────
const EFFORT_COLOR: Record<string, string> = { low: '#7a9478', medium: '#c4a06a', high: '#c07a6a' }
const IMPACT_COLOR: Record<string, string> = { high: '#c07a6a', medium: '#c4a06a', low: '#9e9e9e' }
const URGENCY_COLOR: Record<string, string> = { high: '#c07a6a', medium: '#c4a06a', low: '#9e9e9e' }
const IMPACT_STYLE: Record<string, { bg: string; color: string }> = {
  high: { bg: '#c07a6a18', color: '#c07a6a' },
  medium: { bg: '#c4a06a18', color: '#c4a06a' },
  low: { bg: '#7a947818', color: '#7a9478' },
}
const EFFORT_STYLE: Record<string, { bg: string; color: string }> = {
  low: { bg: '#7a947818', color: '#7a9478' },
  medium: { bg: '#c4a06a18', color: '#c4a06a' },
  high: { bg: '#c07a6a18', color: '#c07a6a' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:    { bg: '#7a947818', color: '#7a9478' },
  achieved:  { bg: '#7a947840', color: '#4a6448' },
  abandoned: { bg: '#9e9e9e18', color: '#9e9e9e' },
  completed: { bg: '#7a947840', color: '#4a6448' },
  paused:    { bg: '#c4a06a18', color: '#c4a06a' },
}

// ── types ─────────────────────────────────────────────────────────────────────
interface StrategyStrength { title: string; evidence: string }
interface StrategyGap { title: string; evidence: string; urgency: 'high' | 'medium' | 'low' }
interface StrategyAction {
  title: string; rationale: string
  effort: 'low' | 'medium' | 'high'; impact: 'high' | 'medium' | 'low'; this_week: string
}
interface StrategyAnalysis {
  summary: string; strengths: StrategyStrength[]; gaps: StrategyGap[]
  actions: StrategyAction[]; _updated_at?: string
}

const TABS = ['Direction', 'Analysis', 'Opportunities'] as const
type Tab = typeof TABS[number]

const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all'
const inputStyle = { background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }

// ── Goal form ─────────────────────────────────────────────────────────────────
function GoalForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<Goal>
  onSave: (data: Partial<Goal>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    timeframe: initial?.timeframe ?? 'annual' as Goal['timeframe'],
    status: initial?.status ?? 'active' as Goal['status'],
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!form.title.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="space-y-3 p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <input
        autoFocus
        value={form.title}
        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
        placeholder="Goal title"
        className={inputClass}
        style={inputStyle}
        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
      />
      <textarea
        value={form.description}
        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        placeholder="Description (optional)"
        rows={2}
        className={inputClass}
        style={{ ...inputStyle, resize: 'none' }}
        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Timeframe</label>
          <select value={form.timeframe} onChange={e => setForm(p => ({ ...p, timeframe: e.target.value as Goal['timeframe'] }))}
            className={inputClass} style={inputStyle}>
            <option value="annual">This year</option>
            <option value="vision">3-year vision</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Status</label>
          <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Goal['status'] }))}
            className={inputClass} style={inputStyle}>
            <option value="active">Active</option>
            <option value="achieved">Achieved</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>Cancel</button>
        <Button size="sm" onClick={submit} loading={saving}>Save goal</Button>
      </div>
    </div>
  )
}

// ── Focus area form ───────────────────────────────────────────────────────────
function FocusAreaForm({
  initial, goals, onSave, onCancel,
}: {
  initial?: Partial<FocusArea>
  goals: Goal[]
  onSave: (data: Partial<FocusArea>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    goal_id: initial?.goal_id ?? '',
    quarter: initial?.quarter ?? '',
    key_results: (initial?.key_results ?? []).join('\n'),
    status: initial?.status ?? 'active' as FocusArea['status'],
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!form.title.trim()) return
    setSaving(true)
    await onSave({
      ...form,
      goal_id: form.goal_id || undefined,
      quarter: form.quarter || undefined,
      key_results: form.key_results.split('\n').map(s => s.trim()).filter(Boolean),
    })
    setSaving(false)
  }

  return (
    <div className="space-y-3 p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
        placeholder="Focus area title" className={inputClass} style={inputStyle}
        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
      <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        placeholder="Description (optional)" rows={2} className={inputClass}
        style={{ ...inputStyle, resize: 'none' }}
        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Linked goal</label>
          <select value={form.goal_id} onChange={e => setForm(p => ({ ...p, goal_id: e.target.value }))}
            className={inputClass} style={inputStyle}>
            <option value="">None</option>
            {goals.filter(g => g.status === 'active').map(g => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Quarter</label>
          <input value={form.quarter} onChange={e => setForm(p => ({ ...p, quarter: e.target.value }))}
            placeholder="2026-Q3" className={inputClass} style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
        </div>
        <div className="w-28">
          <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Status</label>
          <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as FocusArea['status'] }))}
            className={inputClass} style={inputStyle}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Key results — one per line</label>
        <textarea value={form.key_results} onChange={e => setForm(p => ({ ...p, key_results: e.target.value }))}
          placeholder="Book 4 new weddings&#10;Reach 2k Instagram followers" rows={3}
          className={inputClass} style={{ ...inputStyle, resize: 'none' }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>Cancel</button>
        <Button size="sm" onClick={submit} loading={saving}>Save focus area</Button>
      </div>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, style }: { label: string; style: { bg: string; color: string } }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: style.bg, color: style.color }}>{label}</span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StrategyPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Direction')

  // Direction data
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([])
  const [foundationForm, setFoundationForm] = useState({ services_pricing: '', business_goals: '' })
  const [savingFoundation, setSavingFoundation] = useState(false)
  const [addingGoal, setAddingGoal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
  const [addingFocus, setAddingFocus] = useState(false)
  const [editingFocus, setEditingFocus] = useState<string | null>(null)

  // Analysis data
  const [analysis, setAnalysis] = useState<StrategyAnalysis | null>(null)
  const [analysisLoaded, setAnalysisLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [acceptedActions, setAcceptedActions] = useState<Set<number>>(new Set())

  // Opportunities data
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([])
  const [oppsGeneratedAt, setOppsGeneratedAt] = useState<string | null>(null)
  const [oppsLoaded, setOppsLoaded] = useState(false)
  const [generatingOpps, setGeneratingOpps] = useState(false)
  const [oppsStreamText, setOppsStreamText] = useState('')
  const [acceptedOpps, setAcceptedOpps] = useState<Set<number>>(new Set())

  // Initial data load
  useEffect(() => {
    Promise.all([
      fetch('/api/brand').then(r => r.json()),
      fetch('/api/goals').then(r => r.json()),
      fetch('/api/focus-areas').then(r => r.json()),
    ]).then(([b, g, f]) => {
      if (b) {
        setBrand(b)
        setFoundationForm({ services_pricing: b.services_pricing ?? '', business_goals: b.business_goals ?? '' })
      }
      setGoals(Array.isArray(g) ? g : [])
      setFocusAreas(Array.isArray(f) ? f : [])
    })
  }, [])

  // Lazy-load analysis when tab opens
  useEffect(() => {
    if (activeTab === 'Analysis' && !analysisLoaded) {
      setAnalysisLoaded(true)
      fetch('/api/strategy').then(r => r.json()).then(d => { if (d) setAnalysis(d) })
    }
    if (activeTab === 'Opportunities' && !oppsLoaded) {
      setOppsLoaded(true)
      fetch('/api/opportunities').then(r => r.json()).then(d => {
        if (d?.items) { setOpportunities(d.items); setOppsGeneratedAt(d.generated_at) }
      })
    }
  }, [activeTab, analysisLoaded, oppsLoaded])

  // ── Foundation ──────────────────────────────────────────────────────────────
  async function saveFoundation() {
    setSavingFoundation(true)
    try {
      const res = await fetch('/api/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(foundationForm),
      })
      if (!res.ok) throw new Error()
      toast.success('Saved')
    } catch { toast.error('Could not save') }
    finally { setSavingFoundation(false) }
  }

  // ── Goals CRUD ──────────────────────────────────────────────────────────────
  async function createGoal(data: Partial<Goal>) {
    const res = await fetch('/api/goals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    const created = await res.json()
    if (res.ok) { setGoals(prev => [created, ...prev]); setAddingGoal(false); toast.success('Goal added') }
    else toast.error(created.error ?? 'Could not save')
  }

  async function updateGoal(id: string, data: Partial<Goal>) {
    await fetch(`/api/goals/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...data } : g))
    setEditingGoal(null)
    toast.success('Goal updated')
  }

  async function deleteGoal(id: string) {
    if (!confirm('Delete this goal?')) return
    await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  // ── Focus areas CRUD ────────────────────────────────────────────────────────
  async function createFocusArea(data: Partial<FocusArea>) {
    const res = await fetch('/api/focus-areas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    const created = await res.json()
    if (res.ok) { setFocusAreas(prev => [created, ...prev]); setAddingFocus(false); toast.success('Focus area added') }
    else toast.error(created.error ?? 'Could not save')
  }

  async function updateFocusArea(id: string, data: Partial<FocusArea>) {
    await fetch(`/api/focus-areas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    setFocusAreas(prev => prev.map(f => f.id === id ? { ...f, ...data } : f))
    setEditingFocus(null)
    toast.success('Focus area updated')
  }

  async function deleteFocusArea(id: string) {
    if (!confirm('Delete this focus area?')) return
    await fetch(`/api/focus-areas/${id}`, { method: 'DELETE' })
    setFocusAreas(prev => prev.filter(f => f.id !== id))
  }

  // ── Accept as task ──────────────────────────────────────────────────────────
  async function acceptAsTask(action: StrategyAction, index: number) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: action.title,
        description: `${action.rationale}\n\nThis week: ${action.this_week}`,
        priority: action.impact === 'high' ? 'high' : action.impact === 'medium' ? 'medium' : 'low',
        category: 'strategy',
        source: 'ai',
      }),
    })
    if (res.ok) {
      setAcceptedActions(prev => new Set(prev).add(index))
      toast.success('Added to tasks')
    } else {
      toast.error('Could not create task')
    }
  }

  // ── Accept as focus area ────────────────────────────────────────────────────
  async function acceptAsFocusArea(item: OpportunityItem, index: number) {
    const res = await fetch('/api/focus-areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: item.title,
        description: `${item.description}\n\nNext step: ${item.next_step}`,
        source: 'opportunities',
        status: 'active',
        key_results: [item.next_step],
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setFocusAreas(prev => [created, ...prev])
      setAcceptedOpps(prev => new Set(prev).add(index))
      toast.success('Added as focus area')
    } else {
      toast.error('Could not create focus area')
    }
  }

  // ── Strategy Advisor ────────────────────────────────────────────────────────
  async function runAnalysis() {
    setGenerating(true)
    try {
      const res = await fetch('/api/strategy', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setAnalysis(data)
      setAcceptedActions(new Set())
      toast.success('Analysis complete')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate analysis')
    } finally { setGenerating(false) }
  }

  // ── Opportunities ───────────────────────────────────────────────────────────
  async function generateOpps() {
    setGeneratingOpps(true)
    setOppsStreamText('')
    setOpportunities([])
    try {
      const res = await fetch('/api/opportunities', { method: 'POST' })
      if (!res.ok || !res.body) throw new Error()
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setOppsStreamText(accumulated)
      }
      const match = accumulated.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed: OpportunityItem[] = JSON.parse(match[0])
        setOpportunities(parsed)
        setOppsGeneratedAt(new Date().toISOString())
        setAcceptedOpps(new Set())
      }
    } catch { /* silent */ }
    finally { setGeneratingOpps(false); setOppsStreamText('') }
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const activeFocusAreas = focusAreas.filter(f => f.status === 'active')

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Strategy" description="Your direction, goals, and focus — defined by you, supported by AI." />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeTab === tab ? 'var(--foreground)' : 'transparent',
              color: activeTab === tab ? 'var(--background)' : 'var(--muted)',
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Direction ─────────────────────────────────────────────────────────── */}
      {activeTab === 'Direction' && (
        <div className="space-y-8">

          {/* Foundation */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Foundation</h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Used in all AI features as context</p>
            </div>
            <Card>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Services & positioning</label>
                  <textarea
                    value={foundationForm.services_pricing}
                    onChange={e => setFoundationForm(p => ({ ...p, services_pricing: e.target.value }))}
                    rows={4}
                    placeholder="Describe your services, pricing, and how you position yourself in the market…"
                    className={inputClass}
                    style={{ ...inputStyle, resize: 'none' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Business context & direction</label>
                  <textarea
                    value={foundationForm.business_goals}
                    onChange={e => setFoundationForm(p => ({ ...p, business_goals: e.target.value }))}
                    rows={4}
                    placeholder="Where is the business heading? What matters most right now?…"
                    className={inputClass}
                    style={{ ...inputStyle, resize: 'none' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveFoundation} loading={savingFoundation}>Save</Button>
                </div>
              </div>
            </Card>
          </section>

          {/* Goals */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Goals</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Annual targets and longer-term vision</p>
              </div>
              {!addingGoal && (
                <button onClick={() => setAddingGoal(true)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                  style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
                  + Add goal
                </button>
              )}
            </div>

            <div className="space-y-3">
              {addingGoal && (
                <GoalForm onSave={createGoal} onCancel={() => setAddingGoal(false)} />
              )}

              {goals.length === 0 && !addingGoal && (
                <Card>
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>
                    No goals yet. Add one to start tracking your direction.
                  </p>
                </Card>
              )}

              {goals.map(goal => (
                <div key={goal.id}>
                  {editingGoal === goal.id ? (
                    <GoalForm
                      initial={goal}
                      onSave={data => updateGoal(goal.id, data)}
                      onCancel={() => setEditingGoal(null)}
                    />
                  ) : (
                    <Card padding="sm">
                      <div className="px-2 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{goal.title}</p>
                              <Badge
                                label={goal.timeframe === 'vision' ? '3-year vision' : 'This year'}
                                style={{ bg: 'var(--border)', color: 'var(--muted)' }}
                              />
                              <Badge label={goal.status} style={STATUS_STYLE[goal.status] ?? STATUS_STYLE.active} />
                            </div>
                            {goal.description && (
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{goal.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => setEditingGoal(goal.id)}
                              className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
                              Edit
                            </button>
                            <button onClick={() => deleteGoal(goal.id)}
                              className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Focus Areas */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Focus Areas</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Active themes this quarter — what execution is working towards</p>
              </div>
              {!addingFocus && (
                <button onClick={() => setAddingFocus(true)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                  style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
                  + Add focus area
                </button>
              )}
            </div>

            <div className="space-y-3">
              {addingFocus && (
                <FocusAreaForm goals={goals} onSave={createFocusArea} onCancel={() => setAddingFocus(false)} />
              )}

              {focusAreas.length === 0 && !addingFocus && (
                <Card>
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>
                    No focus areas yet. Add one, or accept an Opportunity from the Opportunities tab.
                  </p>
                </Card>
              )}

              {focusAreas.map(fa => {
                const linkedGoal = goals.find(g => g.id === fa.goal_id)
                return (
                  <div key={fa.id}>
                    {editingFocus === fa.id ? (
                      <FocusAreaForm
                        initial={fa}
                        goals={goals}
                        onSave={data => updateFocusArea(fa.id, data)}
                        onCancel={() => setEditingFocus(null)}
                      />
                    ) : (
                      <Card padding="sm">
                        <div className="px-2 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{fa.title}</p>
                                <Badge label={fa.status} style={STATUS_STYLE[fa.status] ?? STATUS_STYLE.active} />
                                {fa.quarter && (
                                  <Badge label={fa.quarter} style={{ bg: 'var(--border)', color: 'var(--muted)' }} />
                                )}
                              </div>
                              {linkedGoal && (
                                <p className="text-[11px] mb-1" style={{ color: 'var(--accent)' }}>
                                  ↳ {linkedGoal.title}
                                </p>
                              )}
                              {fa.description && (
                                <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--muted)' }}>{fa.description}</p>
                              )}
                              {fa.key_results.length > 0 && (
                                <ul className="space-y-0.5">
                                  {fa.key_results.map((kr, i) => (
                                    <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--muted)' }}>
                                      <span style={{ color: 'var(--accent)' }}>◻</span>
                                      {kr}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => setEditingFocus(fa.id)}
                                className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
                                Edit
                              </button>
                              <button onClick={() => deleteFocusArea(fa.id)}
                                className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
                                ×
                              </button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Quick overview of active state */}
          {(activeGoals.length > 0 || activeFocusAreas.length > 0) && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Active now</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Goals ({activeGoals.length})</p>
                  {activeGoals.map(g => (
                    <p key={g.id} className="text-xs mb-1 flex items-start gap-1.5" style={{ color: 'var(--foreground)' }}>
                      <span style={{ color: 'var(--accent)' }}>◎</span>{g.title}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Focus areas ({activeFocusAreas.length})</p>
                  {activeFocusAreas.map(f => (
                    <p key={f.id} className="text-xs mb-1 flex items-start gap-1.5" style={{ color: 'var(--foreground)' }}>
                      <span style={{ color: 'var(--accent)' }}>◇</span>{f.title}
                    </p>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Analysis ──────────────────────────────────────────────────────────── */}
      {activeTab === 'Analysis' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Reads your real data — presence, ROI, content, tasks — and surfaces what to focus on next.
            </p>
            <Button onClick={runAnalysis} loading={generating}>
              {analysis ? 'Re-analyse' : 'Analyse now'}
            </Button>
          </div>

          {!analysis && !generating && (
            <Card>
              <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>
                No analysis yet. Click "Analyse now" to generate insights based on your real data.
              </p>
            </Card>
          )}

          {generating && (
            <Card>
              <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>
                Reading your data and generating analysis…
              </p>
            </Card>
          )}

          {analysis && !generating && (
            <>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Overview</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{analysis.summary}</p>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#7a9478' }}>What&apos;s working</p>
                  <div className="space-y-3">
                    {(analysis.strengths ?? []).map((s, i) => (
                      <div key={i}>
                        <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{s.title}</p>
                        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>{s.evidence}</p>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#c07a6a' }}>Gaps & risks</p>
                  <div className="space-y-3">
                    {(analysis.gaps ?? []).map((g, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{g.title}</p>
                          <Badge label={g.urgency} style={{ bg: URGENCY_COLOR[g.urgency] + '20', color: URGENCY_COLOR[g.urgency] }} />
                        </div>
                        <p className="text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>{g.evidence}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: 'var(--muted)' }}>
                  Recommended actions
                </p>
                <div className="space-y-3">
                  {(analysis.actions ?? []).map((action, i) => (
                    <AnalysisActionCard
                      key={i} action={action} index={i}
                      accepted={acceptedActions.has(i)}
                      onAccept={() => acceptAsTask(action, i)}
                    />
                  ))}
                </div>
              </div>

              {analysis._updated_at && (
                <p className="text-[10px] text-right" style={{ color: 'var(--muted)' }}>
                  Last analysed {new Date(analysis._updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Opportunities ─────────────────────────────────────────────────────── */}
      {activeTab === 'Opportunities' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Prioritised initiatives based on your brand, inspiration references, and presence analysis.
            </p>
            <Button onClick={generateOpps} loading={generatingOpps}>
              {opportunities.length > 0 ? 'Refresh' : 'Generate'}
            </Button>
          </div>

          {generatingOpps && oppsStreamText && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Generating…</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>
                {oppsStreamText.slice(-300)}
              </p>
            </Card>
          )}

          {!oppsLoaded && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
          )}

          {oppsLoaded && opportunities.length === 0 && !generatingOpps && (
            <Card>
              <p className="text-sm py-10 text-center" style={{ color: 'var(--muted)' }}>
                No opportunities generated yet. Click Generate to analyse your brand and presence.
              </p>
            </Card>
          )}

          {opportunities.length > 0 && (
            <>
              {(['social', 'commercial', 'brand', 'technical'] as const)
                .filter(cat => opportunities.some(o => o.category === cat))
                .map(cat => {
                  const icons: Record<string, string> = { social: '✦', commercial: '◇', brand: '◈', technical: '◉' }
                  const labels: Record<string, string> = { social: 'Social Media', commercial: 'Commercial', brand: 'Brand', technical: 'Technical' }
                  const catItems = opportunities.filter(o => o.category === cat)
                  const startIdx = opportunities.findIndex(o => o.category === cat && catItems[0] === o)
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-2 mb-3">
                        <span>{icons[cat]}</span>
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{labels[cat]}</h2>
                      </div>
                      <div className="space-y-3">
                        {catItems.map((item, localIdx) => {
                          const globalIdx = opportunities.indexOf(item)
                          return (
                            <Card key={localIdx} padding="sm">
                              <div className="px-2 pt-3 pb-2">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>{item.title}</p>
                                  <div className="flex gap-1.5 shrink-0 flex-wrap">
                                    <Badge label={`${item.impact} impact`} style={IMPACT_STYLE[item.impact] ?? IMPACT_STYLE.medium} />
                                    <Badge label={`${item.effort} effort`} style={EFFORT_STYLE[item.effort] ?? EFFORT_STYLE.medium} />
                                  </div>
                                </div>
                                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--muted)' }}>{item.description}</p>
                                <div className="flex items-start gap-2 rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--background)' }}>
                                  <span className="text-xs shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>→</span>
                                  <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>
                                    <span className="font-medium">Next step: </span>{item.next_step}
                                  </p>
                                </div>
                                <div className="flex justify-end">
                                  {acceptedOpps.has(globalIdx) ? (
                                    <span className="text-xs" style={{ color: '#7a9478' }}>✓ Added as focus area</span>
                                  ) : (
                                    <button
                                      onClick={() => acceptAsFocusArea(item, globalIdx)}
                                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                                      style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
                                      Accept as focus area
                                    </button>
                                  )}
                                </div>
                              </div>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              {oppsGeneratedAt && (
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  Generated {new Date(oppsGeneratedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Analysis action card ───────────────────────────────────────────────────────
function AnalysisActionCard({
  action, index, accepted, onAccept,
}: {
  action: StrategyAction; index: number; accepted: boolean; onAccept: () => void
}) {
  const [open, setOpen] = useState(index < 2)

  return (
    <Card>
      <button className="w-full flex items-start gap-3 text-left" onClick={() => setOpen(o => !o)}>
        <span className="text-xs font-bold shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>{action.title}</p>
          <div className="flex gap-2 mt-1">
            <Badge label={`${action.effort} effort`} style={{ bg: EFFORT_COLOR[action.effort] + '20', color: EFFORT_COLOR[action.effort] }} />
            <Badge label={`${action.impact} impact`} style={{ bg: IMPACT_COLOR[action.impact] + '20', color: IMPACT_COLOR[action.impact] }} />
          </div>
        </div>
        <span className="text-xs shrink-0 mt-1" style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 pl-8 space-y-3">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{action.rationale}</p>
          <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--cream-200)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>This week</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{action.this_week}</p>
          </div>
          <div className="flex justify-end">
            {accepted ? (
              <span className="text-xs" style={{ color: '#7a9478' }}>✓ Added to tasks</span>
            ) : (
              <button onClick={onAccept}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
                Accept as task
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
