'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (data.success) {
        router.push('/dashboard')
      } else {
        setError(data.error || 'Invalid password')
      }
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-page)' }}>
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 bg-gradient-to-br from-indigo-500/20 to-indigo-600/5 border"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <Lock size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>ProfileOS</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Enter password to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div
            className="rounded-xl border p-5 space-y-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--bg-surface-2)',
                borderColor: error ? '#ef4444' : 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              autoFocus
            />

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
