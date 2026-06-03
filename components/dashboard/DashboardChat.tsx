'use client'

import { useState, useRef, useEffect } from 'react'
import { BrandProfile } from '@/types'
import Button from '@/components/ui/Button'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children }) => <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--border)' }}>{children}</code>,
  h3: ({ children }) => <h3 className="font-semibold mb-1 mt-2">{children}</h3>,
  h2: ({ children }) => <h2 className="font-semibold mb-1 mt-2">{children}</h2>,
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = [
  'What should I focus on this week?',
  'Give me a caption idea for a flat-lay photo',
  'How can I attract more inquiries?',
  'Draft an out-of-office reply',
]

interface Conversation {
  id: string
  name: string
  updated_at: string
}

export default function DashboardChat({ brand }: { brand: BrandProfile | null }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [convName, setConvName] = useState<string>('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // On mount: load the most recent conversation (or create one)
  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const res = await fetch('/api/conversations')
        const raw = await res.json()
        const convs: Conversation[] = Array.isArray(raw) ? raw : []
        let id: string
        let name: string

        if (convs.length > 0) {
          id = convs[0].id
          name = convs[0].name
          setConversations(convs)
        } else {
          const newRes = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'New conversation' }),
          })
          const newConv = await newRes.json()
          id = newConv.id
          name = newConv.name
          setConversations([newConv])
        }

        setConversationId(id)
        setConvName(name)

        const msgRes = await fetch(`/api/chat?conversation_id=${id}`)
        const msgs = await msgRes.json()
        setMessages(Array.isArray(msgs) ? msgs : [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    init()
  }, [])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || streaming || !conversationId) return

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const newHistory = [...history, { role: 'user' as const, content }]

    setMessages(prev => [...prev, { role: 'user', content }, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    let accumulated = ''

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: accumulated }])
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `⚠ ${message}` }])
    } finally {
      setStreaming(false)
    }

    if (accumulated) {
      try {
        await fetch('/api/chat', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            user_content: content,
            assistant_content: accumulated,
          }),
        })

        // Auto-name conversation on first message
        if (messages.length === 0 && convName === 'New conversation') {
          const autoName = content.length > 45 ? content.slice(0, 45).trim() + '…' : content.trim()
          setConvName(autoName)
          setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, name: autoName } : c))
          await fetch(`/api/conversations/${conversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: autoName }),
          })
        }
      } catch { /* save failed silently */ }
    }
  }

  async function switchConversation(id: string) {
    if (id === conversationId || streaming) return
    const conv = conversations.find(c => c.id === id)
    setConversationId(id)
    setConvName(conv?.name ?? '')
    setMessages([])
    try {
      const msgRes = await fetch(`/api/chat?conversation_id=${id}`)
      const msgs = await msgRes.json()
      setMessages(Array.isArray(msgs) ? msgs : [])
    } catch { /* silent */ }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col" style={{ height: '420px' }}>
      {/* Conversation switcher */}
      {!loading && conversations.length > 0 && (
        <div className="px-3 pt-2 pb-1 shrink-0">
          <select
            value={conversationId ?? ''}
            onChange={e => switchConversation(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-lg outline-none transition-all"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            {conversations.slice(0, 8).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
          </div>
        ) : isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="text-2xl mb-3">✦</div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
              Hi{brand?.business_name ? `, ${brand.business_name.split(' ')[0]}` : ''}
            </p>
            <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
              What can I help you with today?
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-2 rounded-lg text-left transition-all hover:opacity-80"
                  style={{ background: 'var(--cream-200)', color: 'var(--stone-600)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed"
                style={
                  msg.role === 'user'
                    ? { background: 'var(--foreground)', color: 'var(--background)' }
                    : { background: 'var(--cream-200)', color: 'var(--foreground)' }
                }
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
                {msg.role === 'assistant' && streaming && i === messages.length - 1 && msg.content === '' && (
                  <span className="inline-flex gap-1">
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
                {msg.role === 'assistant' && streaming && i === messages.length - 1 && msg.content !== '' && (
                  <span className="streaming-cursor" />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask me anything…"
            rows={1}
            className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none transition-all"
            style={{
              background: 'var(--background)',
              border: '1.5px solid var(--border)',
              color: 'var(--foreground)',
              maxHeight: '120px',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
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
