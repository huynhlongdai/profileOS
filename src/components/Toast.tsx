'use client'

import { useEffect } from 'react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  onClose: () => void
  duration?: number
}

const typeConfig = {
  success: { border: '#10b981', icon: '✓', bg: 'rgba(16,185,129,0.12)' },
  error:   { border: '#ef4444', icon: '✕', bg: 'rgba(239,68,68,0.12)' },
  info:    { border: '#6366f1', icon: 'ℹ', bg: 'rgba(99,102,241,0.12)' },
  warning: { border: '#f59e0b', icon: '⚠', bg: 'rgba(245,158,11,0.12)' },
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const cfg = typeConfig[type] || typeConfig.info

  return (
    <div className="animate-slide-in" style={{ pointerEvents: 'auto' }}>
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: `1px solid var(--border-color)`,
          borderLeft: `3px solid ${cfg.border}`,
          minWidth: '260px',
          maxWidth: '400px',
        }}
      >
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: cfg.bg, color: cfg.border }}
        >
          {cfg.icon}
        </span>
        <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{message}</span>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-xs transition-colors ml-1"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ×
        </button>
      </div>
    </div>
  )
}
