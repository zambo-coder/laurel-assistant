'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { Asset } from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<Asset['type'], string> = { design: 'Design', brand: 'Brand', mockup: 'Mockup' }
const TYPE_COLORS: Record<Asset['type'], string> = {
  design: '#c4a06a',
  brand:  '#8b7ab0',
  mockup: '#5a8fbe',
}

const MOCKUP_PRESETS = [
  { id: 'flat_lay', label: 'Flat lay · Florals', prompt: 'Create a beautiful styled flat lay Instagram post photo featuring this wedding invitation design. Arrange it on a soft linen surface with white roses and eucalyptus sprigs. Soft natural window light. Elegant and romantic mood.' },
  { id: 'marble', label: 'Elegant · Marble', prompt: 'Create an elegant styled Instagram post featuring this wedding invitation design. Place it on a white marble surface with subtle gold accents, a small vase of white flowers, and a ribbon. Clean, luxurious, and bright.' },
  { id: 'kraft', label: 'Rustic · Kraft', prompt: 'Create a rustic styled Instagram post featuring this wedding invitation design. Place it on a kraft paper surface with dried pampas grass, dried flower stems, and twine. Warm earthy tones, romantic and whimsical.' },
  { id: 'studio', label: 'Studio · Clean', prompt: 'Create a minimal, clean studio-style Instagram post featuring this wedding invitation design. White background, simple and elegant props. Flat lay perspective. Professional product photography style.' },
  { id: 'autumn', label: 'Seasonal · Autumn', prompt: 'Create a seasonal autumn styled Instagram post featuring this wedding invitation design. Surround it with dried autumn leaves, cinnamon sticks, and small pumpkins. Warm orange and burgundy tones. Cosy and romantic.' },
]

// ─── Upload pending overlay ───────────────────────────────────────────────────

function UploadingOverlay({ names }: { names: string[] }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div className="rounded-2xl px-8 py-6 text-center shadow-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)', minWidth: 280 }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--foreground)', borderTopColor: 'transparent' }} />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Uploading {names.length} file{names.length !== 1 ? 's' : ''}</p>
        {names.slice(0, 3).map(n => (
          <p key={n} className="text-xs truncate" style={{ color: 'var(--muted)', maxWidth: 240 }}>{n}</p>
        ))}
        {names.length > 3 && <p className="text-xs" style={{ color: 'var(--muted)' }}>+{names.length - 3} more</p>}
      </div>
    </div>
  )
}

// ─── Mockup generation modal ──────────────────────────────────────────────────

function MockupModal({
  asset,
  onClose,
  onSaved,
}: {
  asset: Asset
  onClose: () => void
  onSaved: (newAsset: Asset) => void
}) {
  const [preset, setPreset] = useState(MOCKUP_PRESETS[0].id)
  const [customPrompt, setCustomPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<Asset | null>(null)

  const activePreset = MOCKUP_PRESETS.find(p => p.id === preset)

  async function generate() {
    setGenerating(true)
    setResult(null)
    try {
      const prompt = preset === 'custom' ? customPrompt : activePreset?.prompt
      const res = await fetch('/api/assets/generate-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: asset.id, prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setResult(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate mockup')
    } finally {
      setGenerating(false)
    }
  }

  function save() {
    if (result) {
      onSaved(result)
      toast.success('Mockup saved to library')
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Generate mockup</h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Source: {asset.name}</p>
          </div>
          <button onClick={onClose} className="text-xl hover:opacity-60 transition-opacity" style={{ color: 'var(--muted)' }}>×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Style presets */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--muted)' }}>Style</p>
            <div className="flex flex-wrap gap-1.5">
              {MOCKUP_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: preset === p.id ? 'var(--foreground)' : 'var(--background)',
                    color: preset === p.id ? 'var(--background)' : 'var(--muted)',
                    border: `1.5px solid ${preset === p.id ? 'var(--foreground)' : 'var(--border)'}`,
                  }}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setPreset('custom')}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: preset === 'custom' ? 'var(--foreground)' : 'var(--background)',
                  color: preset === 'custom' ? 'var(--background)' : 'var(--muted)',
                  border: `1.5px solid ${preset === 'custom' ? 'var(--foreground)' : 'var(--border)'}`,
                }}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Prompt preview / custom input */}
          {preset === 'custom' ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Custom prompt</label>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                rows={3}
                placeholder="Describe the scene you want around the design…"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none transition-all"
                style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          ) : (
            <div className="p-3 rounded-lg text-xs leading-relaxed" style={{ background: 'var(--cream-200)', color: 'var(--muted)' }}>
              {activePreset?.prompt}
            </div>
          )}

          {/* Generated result */}
          {generating && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--foreground)', borderTopColor: 'transparent' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Generating… this takes about 20–30 seconds</p>
            </div>
          )}

          {result && !generating && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Result</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.url}
                alt="Generated mockup"
                className="w-full rounded-xl object-cover"
                style={{ maxHeight: 360 }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="text-sm hover:opacity-70 transition-opacity px-4 py-2" style={{ color: 'var(--muted)' }}>
            Cancel
          </button>
          {result ? (
            <Button onClick={save}>Save to library</Button>
          ) : (
            <Button onClick={generate} loading={generating} disabled={preset === 'custom' && !customPrompt.trim()}>
              Generate
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  asset,
  onClose,
  onUpdate,
  onDelete,
  onGenerateMockup,
}: {
  asset: Asset
  onClose: () => void
  onUpdate: (id: string, patch: Partial<Asset>) => void
  onDelete: (id: string) => void
  onGenerateMockup: () => void
}) {
  const [name, setName] = useState(asset.name)
  const [type, setType] = useState<Asset['type']>(asset.type)
  const [notes, setNotes] = useState(asset.notes ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(asset.tags ?? [])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setName(asset.name)
    setType(asset.type)
    setNotes(asset.notes ?? '')
    setTags(asset.tags ?? [])
  }, [asset.id, asset.name, asset.type, asset.notes, asset.tags])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, notes, tags }),
      })
      if (!res.ok) throw new Error()
      onUpdate(asset.id, { name, type, notes, tags })
      toast.success('Saved')
    } catch {
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onDelete(asset.id)
      toast.success('Deleted')
    } catch {
      toast.error('Could not delete')
    } finally {
      setDeleting(false)
    }
  }

  function addTag(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const t = tagInput.trim().replace(/,$/, '')
      if (t && !tags.includes(t)) setTags(prev => [...prev, t])
      setTagInput('')
    }
  }

  function removeTag(t: string) { setTags(prev => prev.filter(x => x !== t)) }

  const dirty = name !== asset.name || type !== asset.type || notes !== (asset.notes ?? '') ||
    JSON.stringify(tags) !== JSON.stringify(asset.tags ?? [])

  return (
    <div
      className="w-72 shrink-0 flex flex-col overflow-y-auto"
      style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)', height: 'calc(100vh - 130px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Asset</span>
        <button onClick={onClose} className="text-base hover:opacity-60 transition-opacity" style={{ color: 'var(--muted)' }}>×</button>
      </div>

      {/* Preview */}
      <div className="px-4 pt-4 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.name}
          className="w-full rounded-xl object-cover"
          style={{ maxHeight: 220, background: 'var(--background)' }}
        />
      </div>

      {/* Fields */}
      <div className="px-4 py-4 space-y-4 flex-1">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg text-sm outline-none transition-all"
            style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>Type</label>
          <div className="flex gap-1">
            {(['design', 'brand', 'mockup'] as Asset['type'][]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                style={{
                  background: type === t ? TYPE_COLORS[t] : 'var(--background)',
                  color: type === t ? '#fff' : 'var(--muted)',
                  border: `1.5px solid ${type === t ? TYPE_COLORS[t] : 'var(--border)'}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Tags</label>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {tags.map(t => (
              <span
                key={t}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'var(--cream-200)', color: 'var(--foreground)' }}
              >
                {t}
                <button onClick={() => removeTag(t)} className="hover:opacity-60 transition-opacity leading-none">×</button>
              </span>
            ))}
          </div>
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={addTag}
            placeholder="Add tag, press Enter"
            className="w-full px-3 py-1.5 rounded-lg text-xs outline-none transition-all"
            style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any notes or context…"
            className="w-full px-3 py-1.5 rounded-lg text-xs outline-none resize-none transition-all"
            style={{ background: 'var(--background)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Source info */}
        {asset.source === 'ai_generated' && (
          <p className="text-[11px] px-3 py-1.5 rounded-lg" style={{ background: '#5a8fbe15', color: '#5a8fbe' }}>
            ✦ AI-generated mockup
          </p>
        )}

        {asset.size_bytes && (
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {(asset.size_bytes / 1024 / 1024).toFixed(1)} MB · {new Date(asset.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-4 space-y-2 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        {dirty && (
          <Button onClick={save} loading={saving} className="w-full">Save changes</Button>
        )}
        {type === 'design' && (
          <button
            onClick={onGenerateMockup}
            className="w-full py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ background: 'var(--cream-200)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          >
            ✦ Generate mockup
          </button>
        )}
        <button
          onClick={confirmDelete}
          disabled={deleting}
          className="w-full py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{ background: '#c07a6a15', color: '#c07a6a', border: '1px solid #c07a6a30' }}
        >
          {deleting ? 'Deleting…' : 'Delete asset'}
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Asset['type'] | 'all'>('all')
  const [selected, setSelected] = useState<Asset | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingNames, setUploadingNames] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [mockupTarget, setMockupTarget] = useState<Asset | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/assets')
      .then(r => r.json())
      .then(data => setAssets(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Could not load assets'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? assets : assets.filter(a => a.type === filter)

  const counts: Record<string, number> = {
    all: assets.length,
    design: assets.filter(a => a.type === 'design').length,
    brand: assets.filter(a => a.type === 'brand').length,
    mockup: assets.filter(a => a.type === 'mockup').length,
  }

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf')
    if (!arr.length) { toast.error('Only images and PDFs are supported'); return }

    setUploading(true)
    setUploadingNames(arr.map(f => f.name))

    const results: Asset[] = []
    for (const file of arr) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''))
      try {
        const res = await fetch('/api/assets/upload', { method: 'POST', body: formData })
        if (res.ok) results.push(await res.json())
        else toast.error(`Failed to upload ${file.name}`)
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    setAssets(prev => [...results, ...prev])
    if (results.length) toast.success(`${results.length} file${results.length !== 1 ? 's' : ''} uploaded`)
    setUploading(false)
    setUploadingNames([])
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleUpdate(id: string, patch: Partial<Asset>) {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev)
  }

  function handleDelete(id: string) {
    setAssets(prev => prev.filter(a => a.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  function handleMockupSaved(newAsset: Asset) {
    setAssets(prev => [newAsset, ...prev])
    setMockupTarget(null)
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Asset Library"
        description="Your designs, brand files, and AI-generated post mockups"
        action={
          <Button onClick={() => fileInputRef.current?.click()}>Upload</Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />

      {uploading && <UploadingOverlay names={uploadingNames} />}
      {mockupTarget && (
        <MockupModal
          asset={mockupTarget}
          onClose={() => setMockupTarget(null)}
          onSaved={handleMockupSaved}
        />
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 flex-wrap">
        {(['all', 'design', 'brand', 'mockup'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize"
            style={{
              background: filter === t ? 'var(--foreground)' : 'var(--surface)',
              color: filter === t ? 'var(--background)' : 'var(--muted)',
              border: `1px solid ${filter === t ? 'var(--foreground)' : 'var(--border)'}`,
            }}
          >
            {t === 'all' ? 'All' : TYPE_LABELS[t as Asset['type']]} {counts[t] > 0 && <span className="opacity-60">{counts[t]}</span>}
          </button>
        ))}
      </div>

      {/* Main area */}
      <div className="flex gap-5 flex-1 min-h-0">
        {/* Grid */}
        <div
          className="flex-1 min-w-0"
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <div
                className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl border-2 border-dashed transition-all"
                style={{ borderColor: dragOver ? 'var(--foreground)' : 'var(--border)', background: dragOver ? 'var(--cream-200)' : 'transparent' }}
              >
                <p className="text-3xl opacity-30">⊞</p>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {dragOver ? 'Drop files here' : 'No assets yet'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                    Drag & drop images or click Upload to get started
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'var(--foreground)', color: 'var(--background)' }}
                >
                  Upload files
                </button>
              </div>
            </Card>
          ) : (
            <div
              className="rounded-xl border-2 border-dashed transition-all"
              style={{ borderColor: dragOver ? 'var(--foreground)' : 'transparent', background: dragOver ? 'var(--cream-200)' : 'transparent' }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            >
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                {filtered.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => setSelected(prev => prev?.id === asset.id ? null : asset)}
                    className="rounded-xl overflow-hidden text-left transition-all hover:opacity-90 group relative"
                    style={{
                      border: `2px solid ${selected?.id === asset.id ? 'var(--foreground)' : 'var(--border)'}`,
                      background: 'var(--surface)',
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="w-full aspect-square overflow-hidden" style={{ background: 'var(--cream-200)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="px-2.5 py-2">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{asset.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: `${TYPE_COLORS[asset.type]}20`, color: TYPE_COLORS[asset.type] }}
                        >
                          {TYPE_LABELS[asset.type]}
                        </span>
                        {asset.source === 'ai_generated' && (
                          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>✦ AI</span>
                        )}
                      </div>
                    </div>

                    {/* Quick generate mockup badge on hover */}
                    {asset.type === 'design' && (
                      <div
                        className="absolute inset-0 flex items-end justify-center pb-12 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.2)' }}
                        onClick={e => { e.stopPropagation(); setMockupTarget(asset) }}
                      >
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.9)', color: 'var(--foreground)' }}>
                          ✦ Mockup
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            asset={selected}
            onClose={() => setSelected(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onGenerateMockup={() => setMockupTarget(selected)}
          />
        )}
      </div>
    </div>
  )
}
