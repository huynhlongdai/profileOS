'use client'

import { useState, useEffect } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import Modal from '@/components/Modal'

interface BrowserConnection {
  id: string
  name: string
  apiUrl: string
  apiVersion: string
  providerType: string
  description: string | null
  isEnabled: boolean
  isDefault: boolean
}

const EMPTY_FORM = {
  name: '',
  apiUrl: '',
  apiVersion: 'v3',
  providerType: 'gpmlogin',
  description: '',
  isDefault: false,
  isEnabled: true,
}

const PROVIDER_OPTIONS = [
  { value: 'gpmlogin', label: 'GPMLogin Local', presetUrl: 'http://127.0.0.1:19496', presetVersion: 'v3' },
  { value: 'gpmlogin_global', label: 'GPMLogin Global', presetUrl: 'http://127.0.0.1:9495', presetVersion: 'v1' },
]

const BUILTIN_IDS = ['local-gpm', 'global-gpm']

export default function BrowserConnectionsPage() {
  const [connections, setConnections] = useState<BrowserConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { showToast } = useToastContext()

  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM })

  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/browser-connections')
      const data = await res.json()
      if (data.success) {
        setConnections(data.connections || [])
      }
    } catch {
      showToast('Lỗi khi tải danh sách kết nối', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyProviderPreset = (
    providerType: string,
    setter: React.Dispatch<React.SetStateAction<typeof formData>>
  ) => {
    const preset = PROVIDER_OPTIONS.find((p) => p.value === providerType)
    if (!preset) return
    setter((prev) => ({
      ...prev,
      providerType,
      apiUrl: prev.apiUrl || preset.presetUrl,
      apiVersion: preset.presetVersion,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/browser-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Đã thêm kết nối mới', 'success')
        setFormData({ ...EMPTY_FORM })
        fetchConnections()
      } else {
        showToast(data.error || 'Lỗi khi lưu', 'error')
      }
    } catch {
      showToast('Lỗi kết nối server', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (conn: BrowserConnection) => {
    setEditingId(conn.id)
    setEditForm({
      name: conn.name,
      apiUrl: conn.apiUrl,
      apiVersion: conn.apiVersion,
      providerType: conn.providerType,
      description: conn.description || '',
      isDefault: conn.isDefault,
      isEnabled: conn.isEnabled,
    })
  }

  const closeEdit = () => {
    setEditingId(null)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/browser-connections/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Đã cập nhật kết nối', 'success')
        closeEdit()
        fetchConnections()
      } else {
        showToast(data.error || 'Lỗi khi cập nhật', 'error')
      }
    } catch {
      showToast('Lỗi kết nối server', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (id: string, apiUrl?: string, apiVersion?: string) => {
    setTestingId(id)
    try {
      const res =
        id === 'draft'
          ? await fetch('/api/browser-connections/test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiUrl, apiVersion }),
            })
          : await fetch(`/api/browser-connections/${id}/test`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        showToast(data.message || 'Kết nối thành công', 'success')
      } else {
        showToast(data.message || data.error || 'Kết nối thất bại', 'error')
      }
    } catch {
      showToast('Lỗi khi kiểm tra kết nối', 'error')
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Xóa kết nối "${name}"?`)) return
    try {
      const res = await fetch(`/api/browser-connections/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showToast('Đã xóa kết nối', 'success')
        fetchConnections()
      } else {
        showToast(data.error || 'Không thể xóa', 'error')
      }
    } catch {
      showToast('Lỗi kết nối server', 'error')
    }
  }

  const connectionFormFields = (
    data: typeof formData & { isEnabled?: boolean },
    setData: React.Dispatch<React.SetStateAction<typeof formData & { isEnabled?: boolean }>>,
  ) => (
    <>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Tên kết nối</label>
        <input
          type="text"
          required
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          placeholder="GPMLogin Local"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">API URL</label>
        <input
          type="url"
          required
          value={data.apiUrl}
          onChange={(e) => setData({ ...data, apiUrl: e.target.value })}
          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                  placeholder="http://127.0.0.1:19496"
        />
        <p className="text-xs text-gray-500 mt-1">Local: port 19995 · Global: port 9495</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">API Version</label>
          <select
            value={data.apiVersion}
            onChange={(e) => setData({ ...data, apiVersion: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="v3">v3</option>
            <option value="v2">v2</option>
            <option value="v1">v1</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Loại trình duyệt</label>
          <select
            value={data.providerType}
            onChange={(e) => applyProviderPreset(e.target.value, setData)}
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={editingId ? BUILTIN_IDS.includes(editingId) : false}
          >
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả</label>
        <textarea
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={data.isDefault}
            onChange={(e) => setData({ ...data, isDefault: e.target.checked })}
            className="w-4 h-4 rounded text-blue-600"
          />
          Mặc định cho loại này
        </label>
        {'isEnabled' in data && (
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={data.isEnabled}
              onChange={(e) => setData({ ...data, isEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600"
            />
            Bật kết nối
          </label>
        )}
      </div>
    </>
  )

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Cài đặt trình duyệt</h1>
        <p className="mt-2 text-lg text-gray-600">
          Gán URL API cho GPMLogin Local, GPM Global và các kết nối khác.
        </p>
        <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          GPMLogin Local thường dùng <strong>http://127.0.0.1:19496</strong> (hoặc cổng bạn cấu hình trong app GPM).
          Sau khi sửa URL, bấm <strong>Kiểm tra</strong> — phải thành công trước khi mở profile.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sticky top-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">➕</span>
              Thêm kết nối
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              {connectionFormFields(formData, setFormData)}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu kết nối'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : connections.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500 mb-4">Chưa có kết nối. Chạy seed hoặc thêm mới.</p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">node scripts/seed_connections.js</code>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className={`bg-white p-6 rounded-2xl shadow-sm border transition-all hover:shadow-md ${
                    conn.isDefault ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'
                  } ${!conn.isEnabled ? 'opacity-60' : ''}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div
                        className={`p-3 rounded-xl shrink-0 ${
                          conn.id === 'local-gpm'
                            ? 'bg-indigo-100 text-indigo-600'
                            : conn.id === 'global-gpm'
                              ? 'bg-purple-100 text-purple-600'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <span className="text-2xl">🌐</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900">{conn.name}</h3>
                          {conn.isDefault && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase">
                              Mặc định
                            </span>
                          )}
                          {!conn.isEnabled && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded-full uppercase">
                              Tắt
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-mono text-gray-700 mt-1 break-all">{conn.apiUrl}</p>
                        {conn.description && (
                          <p className="text-gray-600 mt-2 text-sm">{conn.description}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">
                            API {conn.apiVersion}
                          </span>
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">
                            {conn.providerType === 'gpmlogin_global' ? 'GPM Global' : 'GPM Local'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={testingId === conn.id}
                        onClick={() => handleTest(conn.id)}
                        className="px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {testingId === conn.id ? '...' : 'Kiểm tra'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(conn)}
                        className="px-3 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        Sửa
                      </button>
                      {!BUILTIN_IDS.includes(conn.id) && (
                        <button
                          type="button"
                          onClick={() => handleDelete(conn.id, conn.name)}
                          className="px-3 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={!!editingId} onClose={closeEdit} title="Chỉnh sửa kết nối" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-5 p-1">
          {connectionFormFields(editForm, setEditForm)}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={testingId === 'draft'}
              onClick={() => handleTest('draft', editForm.apiUrl, editForm.apiVersion)}
              className="py-2.5 px-4 border border-emerald-300 text-emerald-800 font-semibold rounded-xl hover:bg-emerald-50 disabled:opacity-50"
            >
              {testingId === 'draft' ? 'Đang kiểm tra...' : 'Kiểm tra URL'}
            </button>
            <button
              type="button"
              onClick={closeEdit}
              className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
