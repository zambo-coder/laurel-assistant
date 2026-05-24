'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Incorrect email or password.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm px-8">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#fdf8f0', border: '1.5px solid #e8dfd0' }}>
            <span className="text-2xl">✦</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Studio Co-pilot
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>
            Your personal business assistant
          </p>
        </div>

        {urlError === 'unauthorized' && (
          <div className="mb-5 p-3.5 rounded-lg text-sm text-center"
            style={{ background: '#fdf0f0', border: '1px solid #f5c6c6', color: '#8b3030' }}>
            This account is not authorized to access this app.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{ background: '#ffffff', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{ background: '#ffffff', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#8b3030' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: 'var(--foreground)', color: '#faf8f4' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
