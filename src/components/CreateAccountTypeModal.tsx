'use client'

import { useState } from 'react'
import { useToastContext } from './ToastProvider'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function CreateAccountTypeModal({ isOpen, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({ name: '', label: '', icon: '', description: '', sortOrder: 0 })
  const [saving, setSaving] = useState(false)
  const { showToast } = useToastContext()

  const reset = () => setForm({ name: '', label: '', icon: '', description: '', sortOrder: 0 })

  const handleSubmit = async () => {
    if (!form.name || !form.label) {
      showToast('Name và Label là bắt buộc', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/account-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, isActive: true }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('✅ Đã tạo account type', 'success')
        reset()
        onClose()
        onSuccess?.()
      } else {
        showToast(data.error || 'Tạo thất bại', 'error')
      }
    } catch {
      showToast('Lỗi kết nối', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative z-50 w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">➕ Tạo Account Type</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name * <span className="text-gray-400 font-normal">(chữ thường, không dấu, dùng _-)</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                placeholder="vd: instagram, tiktok"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Label *</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="vd: Instagram, TikTok"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Icon (Emoji)</label>
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="📷"
                  maxLength={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Mô tả ngắn (không bắt buộc)"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <button
              onClick={() => { reset(); onClose() }}
              className="px-4 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Đang tạo...' : '✅ Tạo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
