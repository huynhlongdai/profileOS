'use client'

import { useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  if (!isOpen) return null

  const maxWidth =
    size === 'sm' ? 'max-w-sm' :
    size === 'md' ? 'max-w-md' :
    size === 'lg' ? 'max-w-2xl' :
    'max-w-4xl'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-70 transition-opacity" onClick={onClose} />

        {/* Modal panel */}
        <div
          className={`relative z-50 w-full transform rounded-xl shadow-2xl transition-all animate-fade-in ${maxWidth}`}
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-md p-1 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[80vh] overflow-y-auto px-6 py-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
