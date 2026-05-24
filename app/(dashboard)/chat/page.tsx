'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children }) => <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--border)' }}>{children}</code>,
  h2: ({ children }) => <h2 className="font-semibold mb-1 mt-3">{children}</h2>,
  h3: ({ children }) => <h3 className="font-semibold mb-1 mt-2">{children}</h3>,
}

const STARTERS = [
  'What should I focus on this week?',
  'Give me a caption idea for a flat-lay photo',
  'How can I attract more inquiries?',
  'Draft an out-of-office reply for the holidays',
  'Suggest 3 reel ideas for this month',
  'Help me price a custom stationery suite',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load history on mount
  useEffect(() => {
    fetch('/api/chat')
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setMessages(data) : setMessages([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || streaming) return

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const newHistory = [...history, { role: 'user' as const, content }]

    const userMsg: Message = { role: 'user', content }
    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, save: true }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: accumulated },
        ])
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `⚠ ${message}` },
      ])
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  async function clearHistory() {
    if (!confirm('Clear all conversation history?')) return
    setClearing(true)
    await fetch('/api/chat', { method: 'DELETE' })
    setMessages([])
    setClearing(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="flex items-start justify-between mb-4 shrink-0">
        <PageHeader
          title="AI Assistant"
          description="Your brand-aware business co-pilot. Conversations are saved."
        />
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            disabled={clearing}
            className="text-xs mt-1 hover:opacity-70 transition-opacity shrink-0"
            style={{ color: 'var(--muted)' }}
          >
            {clearing ? 'Clearing…' : 'Clear history'}
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto rounded-2xl mb-4 px-4 py-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading conversation…</p>
          </div>
        ) : isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="text-3xl mb-4">✦</div>
            <p className="text-base font-medium mb-1" style={{ color: 'var(--foreground)' }}>
              What can I help you with?
            </p>
            <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
              Ask me anything about your business — content, strategy, pricing, copy.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {STARTERS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-2.5 rounded-xl text-left transition-all hover:opacity-80"
                  style={{ background: 'var(--cream-200)', color: 'var(--stone-600)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <div key={msg.id ?? i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mr-2 mt-0.5"
                    style={{ background: 'var(--foreground)', color: 'var(--background)' }}
                  >
                    ✦
                  </div>
                )}
                <div
                  className="max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={
                    msg.role === 'user'
                      ? { background: 'var(--foreground)', color: 'var(--background)' }
                      : { background: 'var(--cream-200)', color: 'var(--foreground)' }
                  }
                >
                  {msg.role === 'assistant' ? (
                    <>
                      <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                      {streaming && i === messages.length - 1 && msg.content === '' && (
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      )}
                      {streaming && i === messages.length - 1 && msg.content !== '' && (
                        <span className="streaming-cursor" />
                      )}
                    </>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0">
        <div
          className="flex items-end gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask me anything…"
            rows={1}
            className="flex-1 text-sm outline-none resize-none bg-transparent"
            style={{
              color: 'var(--foreground)',
              maxHeight: '160px',
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 160) + 'px'
            }}
          />
          <Button size="sm" onClick={() => send()} disabled={!input.trim() || streaming}>
            ↑
          </Button>
        </div>
        <p className="text-[10px] mt-1.5 ml-1" style={{ color: 'var(--muted)' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
