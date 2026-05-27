'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

const commands = [
  { label: 'Dashboard', href: '/dashboard', keywords: 'home overview stats' },
  { label: 'Profiles', href: '/profiles', keywords: 'browser gpm chrome firefox' },
  { label: 'Accounts', href: '/accounts', keywords: 'gmail outlook email' },
  { label: 'Proxies', href: '/proxies', keywords: 'proxy ip' },
  { label: 'Tasks', href: '/tasks', keywords: 'automation execution' },
  { label: 'Logs', href: '/logs', keywords: 'log error info warning' },
  { label: 'Modules', href: '/modules', keywords: 'plugin gmail coingecko' },
  { label: 'Workflows', href: '/workflows', keywords: 'workflow builder automation engine' },
  { label: 'Automation', href: '/automation', keywords: 'template recording' },
  { label: 'Recordings', href: '/recordings', keywords: 'record replay action' },
  { label: 'Auto Register', href: '/auto-register', keywords: 'register create account' },
  { label: 'Account Types', href: '/account-types', keywords: 'type category' },
  { label: 'Settings', href: '/settings/automation', keywords: 'config setting' },
  { label: 'Browser Connections', href: '/settings/browser-connections', keywords: 'connection gpm browser' },
  { label: 'Google Sheets', href: '/settings/google-sheets', keywords: 'sheets google sync' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  const filtered = query
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  const handleSelect = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-md px-4">
        <div
          className="rounded-xl border shadow-2xl overflow-hidden animate-scale-in"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length > 0) {
                  handleSelect(filtered[0].href)
                }
              }}
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>ESC</kbd>
          </div>
          <div className="max-h-[300px] overflow-y-auto py-1">
            {filtered.map((cmd) => (
              <button
                key={cmd.href}
                onClick={() => handleSelect(cmd.href)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                {cmd.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No results
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
