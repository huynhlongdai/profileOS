'use client'

import { Menu, LogOut, Search } from 'lucide-react'
import AgentStatus from './AgentStatus'
import { useRouter } from 'next/navigation'

interface TopBarProps {
  onMenuToggle: () => void
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
  }

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Menu size={20} />
        </button>
        <span className="md:hidden text-sm font-semibold" style={{ color: 'var(--accent)' }}>
          ⚡ ProfileOS
        </span>

        {/* Search button */}
        <button
          onClick={openSearch}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors hover:bg-white/5"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
        >
          <Search size={14} />
          <span>Search...</span>
          <kbd className="text-[10px] px-1 py-0.5 rounded border ml-2" style={{ borderColor: 'var(--border-color)' }}>Ctrl+K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <AgentStatus />
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
