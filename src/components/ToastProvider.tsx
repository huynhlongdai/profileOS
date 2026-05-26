'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import Toast from './Toast'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToastContext() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToastContext must be used within ToastProvider')
  return context
}

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast stack — fixed top-right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2" style={{ pointerEvents: 'none' }}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
