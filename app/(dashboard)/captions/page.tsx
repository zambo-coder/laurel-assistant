'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Textarea from '@/components/ui/Textarea'
import { Caption, CaptionHistory } from '@/types'

type ParsedCaption = Caption
type HashtagSet = 'niche' | 'broad' | 'local'

const HASHTAG_LABELS: Record<HashtagSet, string> = {
  niche: 'Niche',
  broad: 'Broad',
  local: 'Local',
}

export default function CaptionsPage() {
  const [prompt, setPrompt] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [rawText, setRawText] = useState('')
  const [captions, setCaptions] = useState<ParsedCaption[]>([])
  const [activeHashtag, setActiveHashtag] = useState<Record<number, HashtagSet>>({})
  const [history, setHistory] = useState<CaptionHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  async function generate() {
    if (!prompt.trim() || streaming) return
    setStreaming(true)
    setRawText('')
    setCaptions([])

    try {
      const res = await fetch('/api/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok || !res.body) throw new Error('Generation failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setRawText(full)
      }

      const parsed = parseCaptions(full)
      setCaptions(parsed)
      setActiveHashtag({})
    } catch {
      toast.error('Generation failed. Please try again.')
    } finally {
      setStreaming(false)
    }
  }

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/captions/history')
      const data = await res.json()
      setHistory(data)
    } catch {
      toast.error('Could not load history')
    } finally {
      setLoadingHistory(false)
    }
  }

  function copyCaption(caption: ParsedCaption, index: number) {
    const set = activeHashtag[index] ?? 'niche'
    const tags = caption.hashtags[set].join(' ')
    const text = `${caption.text}\n\n${tags}`
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  function copyHashtags(tags: string[]) {
    navigator.clipboard.writeText(tags.join(' '))
    toast.success('Hashtags copied')
  }

  function loadFromHistory(item: CaptionHistory) {
    setCaptions(item.captions)
    setPrompt(item.prompt)
    setRawText('')
    setShowHistory(false)
    setActiveHashtag({})
  }

  const showStreaming = streaming && captions.length === 0

  return (
    <div>
      <PageHeader
        title="Caption Generator"
        description="Describe your post and get 5 on-brand caption options with hashtags"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory() }}
          >
            {showHistory ? 'Hide history' : 'History'}
          </Button>
        }
      />

      {/* History panel */}
      {showHistory && (
        <Card className="mb-6">
          <p className="text-sm font-medium mb-4" style={{ color: 'var(--foreground)' }}>Past generations</p>
          {loadingHistory ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No history yet</p>
          ) : (
            <ul className="space-y-2">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => loadFromHistory(item)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all hover:opacity-80"
                    style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
                  >
                    <span className="block font-medium line-clamp-1" style={{ color: 'var(--foreground)' }}>
                      {item.prompt}
                    </span>
                    <span className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {item.captions.length} captions · {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Input */}
      <Card className="mb-6">
        <Textarea
          label="Describe your post"
          placeholder="e.g. A close-up of a wax seal on a dusty pink envelope, natural light, linen texture in the background. For a September wedding in Denmark."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) generate() }}
        />
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>⌘ + Enter to generate</p>
          <Button onClick={generate} loading={streaming} disabled={!prompt.trim()}>
            {streaming ? 'Generating…' : 'Generate captions'}
          </Button>
        </div>
      </Card>

      {/* Streaming preview */}
      {showStreaming && (
        <Card>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>GENERATING</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap streaming-cursor" style={{ color: 'var(--foreground)' }}>
            {rawText || ' '}
          </p>
        </Card>
      )}

      {/* Results */}
      {captions.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            5 caption options
          </p>
          {captions.map((caption, i) => {
            const activeSet = activeHashtag[i] ?? 'niche'
            return (
              <Card key={i}>
                {/* Caption number */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Option {i + 1}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => copyCaption(caption, i)}>
                    Copy caption + tags
                  </Button>
                </div>

                {/* Caption text */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap mb-5" style={{ color: 'var(--foreground)' }}>
                  {caption.text}
                </p>

                {/* Hashtag sets */}
                <div>
                  <div className="flex gap-2 mb-3">
                    {(['niche', 'broad', 'local'] as HashtagSet[]).map((set) => (
                      <button
                        key={set}
                        onClick={() => setActiveHashtag((prev) => ({ ...prev, [i]: set }))}
                        className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                        style={{
                          background: activeSet === set ? 'var(--foreground)' : 'var(--border)',
                          color: activeSet === set ? 'var(--background)' : 'var(--muted)',
                        }}
                      >
                        {HASHTAG_LABELS[set]}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {caption.hashtags[activeSet].map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--cream-200,#f4efe6)', color: 'var(--stone-600,#655a4d)' }}
                      >
                        {tag}
                      </span>
                    ))}
                    <button
                      onClick={() => copyHashtags(caption.hashtags[activeSet])}
                      className="text-xs px-2 py-0.5 rounded-full transition-opacity hover:opacity-70"
                      style={{ background: 'var(--border)', color: 'var(--muted)' }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function parseCaptions(text: string): ParsedCaption[] {
  const captions: ParsedCaption[] = []
  const blocks = text.split('---').map(b => b.trim()).filter(Boolean)

  for (const block of blocks) {
    const captionMatch = block.match(/CAPTION_\d+:\n([\s\S]*?)(?=\nNICHE_TAGS)/i)
    const nicheMatch = block.match(/NICHE_TAGS_\d+:\s*(.+)/i)
    const broadMatch = block.match(/BROAD_TAGS_\d+:\s*(.+)/i)
    const localMatch = block.match(/LOCAL_TAGS_\d+:\s*(.+)/i)

    if (captionMatch) {
      captions.push({
        text: captionMatch[1].trim(),
        hashtags: {
          niche: nicheMatch ? nicheMatch[1].trim().split(/\s+/) : [],
          broad: broadMatch ? broadMatch[1].trim().split(/\s+/) : [],
          local: localMatch ? localMatch[1].trim().split(/\s+/) : [],
        },
      })
    }
  }

  return captions
}
