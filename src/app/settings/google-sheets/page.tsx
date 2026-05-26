'use client'

import { useEffect, useState, useCallback } from 'react'
import { useToastContext } from '@/components/ToastProvider'

interface GoogleSheetsConfig {
  gasWebAppUrl: string
  secretToken: string
  lastSync?: string
  autoSync?: boolean
  autoSyncIntervalMinutes?: number
}

interface PushResult {
  accounts: number
  profiles: number
  timestamp: string
}

export default function GoogleSheetsSettingsPage() {
  const [config, setConfig] = useState<GoogleSheetsConfig>({
    gasWebAppUrl: '',
    secretToken: '',
    autoSync: false,
    autoSyncIntervalMinutes: 60,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastPushResult, setLastPushResult] = useState<PushResult | null>(null)
  const { showToast } = useToastContext()

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/google-sheets/config')
      const data = await res.json()
      if (data.success && data.config) {
        setConfig(data.config)
      }
    } catch (error) {
      console.error('Error fetching Google Sheets config:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const saveConfig = async () => {
    if (!config.gasWebAppUrl.trim()) {
      showToast('Vui lòng nhập GAS Web App URL', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/google-sheets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Đã lưu cấu hình Google Sheets ✓', 'success')
        setConfig(data.config)
      } else {
        showToast(data.error || 'Lỗi khi lưu cấu hình', 'error')
      }
    } catch (error) {
      console.error(error)
      showToast('Lỗi kết nối server', 'error')
    } finally {
      setSaving(false)
    }
  }

  const syncNow = async () => {
    if (!config.gasWebAppUrl.trim()) {
      showToast('Chưa cấu hình GAS Web App URL. Hãy lưu cài đặt trước.', 'error')
      return
    }
    setSyncing(true)
    try {
      const res = await fetch('/api/google-sheets/push', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setLastPushResult(data.pushed)
        setConfig(prev => ({ ...prev, lastSync: data.pushed.timestamp }))
        showToast(
          `✓ Đã sync ${data.pushed.accounts} accounts, ${data.pushed.profiles} profiles lên Google Sheets`,
          'success'
        )
      } else {
        showToast(data.error || 'Lỗi khi sync', 'error')
      }
    } catch (error) {
      console.error(error)
      showToast('Lỗi kết nối server', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const testConnection = async () => {
    if (!config.gasWebAppUrl.trim()) {
      showToast('Vui lòng nhập GAS Web App URL trước', 'error')
      return
    }
    setSyncing(true)
    try {
      // Gửi payload test nhỏ
      const testPayload = {
        secretToken: config.secretToken,
        timestamp: new Date().toISOString(),
        accounts: [{ index: 1, label: 'TEST', accountType: 'test', identifier: 'test@test.com', status: 'active', notes: 'Connection test', profileName: '', proxyLabel: '', lastLogin: '', updatedAt: new Date().toISOString() }],
        profiles: [],
      }
      const res = await fetch(config.gasWebAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      })
      if (res.ok) {
        showToast('✓ Kết nối thành công với Google Sheets!', 'success')
      } else {
        showToast(`GAS trả về status ${res.status} – kiểm tra URL và token`, 'error')
      }
    } catch {
      showToast('Không thể kết nối đến GAS Web App. CORS có thể bị chặn khi test trực tiếp từ browser. Hãy dùng nút "Sync ngay" để test từ server.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return null
    return new Date(isoString).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        <p className="mt-2 text-gray-600">Đang tải cấu hình...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">📊</span>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Google Sheets Sync</h1>
          <p className="text-gray-500 text-sm mt-1">
            Đẩy dữ liệu Accounts &amp; Profiles lên Google Sheets để xem từ bất kỳ đâu
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">📌 Cách hoạt động</h3>
        <div className="flex items-center gap-2 text-sm text-blue-700 flex-wrap">
          <span className="bg-white border border-blue-200 rounded px-2 py-1">GPMTool (local)</span>
          <span>→ POST JSON →</span>
          <span className="bg-white border border-blue-200 rounded px-2 py-1">GAS Web App (HTTPS public)</span>
          <span>→ ghi vào →</span>
          <span className="bg-white border border-blue-200 rounded px-2 py-1">Google Sheet</span>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          ✓ Không cần IP public hay ngrok — app push ra ngoài qua HTTPS bình thường
        </p>
      </div>

      {/* Config Card */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">⚙️ Cấu hình</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GAS Web App URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={config.gasWebAppUrl}
              onChange={(e) => setConfig({ ...config, gasWebAppUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-mono"
            />
            <p className="mt-1 text-xs text-gray-500">
              URL được cấp sau khi Deploy Google Apps Script as Web App
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secret Token
            </label>
            <input
              type="text"
              value={config.secretToken}
              onChange={(e) => setConfig({ ...config, secretToken: e.target.value })}
              placeholder="Nhập token bảo mật (khớp với SECRET_TOKEN trong Code.gs)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Phải khớp với biến <code className="bg-gray-100 px-1 rounded">SECRET_TOKEN</code> trong file Code.gs
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              {saving ? 'Đang lưu...' : '💾 Lưu cài đặt'}
            </button>
            <button
              onClick={testConnection}
              disabled={syncing}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              {syncing ? '...' : '🔍 Test kết nối'}
            </button>
          </div>
        </div>
      </div>

      {/* Sync Card */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">🔄 Đồng bộ</h2>
        <p className="text-sm text-gray-500 mb-4">
          Push toàn bộ Accounts và Profiles hiện tại lên Google Sheets. Dữ liệu trong Sheet sẽ được ghi đè.
        </p>

        {/* Last sync info */}
        {config.lastSync && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
            ✓ Lần sync cuối: <strong>{formatDateTime(config.lastSync)}</strong>
            {lastPushResult && (
              <span className="ml-2 text-green-600">
                ({lastPushResult.accounts} accounts, {lastPushResult.profiles} profiles)
              </span>
            )}
          </div>
        )}

        <button
          onClick={syncNow}
          disabled={syncing || !config.gasWebAppUrl}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-2"
        >
          {syncing ? (
            <>
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Đang sync...
            </>
          ) : (
            '📤 Sync ngay lên Google Sheets'
          )}
        </button>
      </div>

      {/* Setup Guide */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 Hướng dẫn cài đặt</h2>
        <ol className="space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <p className="font-medium text-gray-800">Mở Google Sheets</p>
              <p className="text-gray-500">Tạo một Google Spreadsheet mới tại <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">sheets.google.com</a></p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <p className="font-medium text-gray-800">Mở Apps Script</p>
              <p className="text-gray-500">Trong Sheet: <strong>Extensions → Apps Script</strong> → Xóa code cũ, paste toàn bộ nội dung file <code className="bg-gray-100 px-1 rounded">google-apps-script/Code.gs</code></p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <p className="font-medium text-gray-800">Đặt Secret Token</p>
              <p className="text-gray-500">Sửa dòng <code className="bg-gray-100 px-1 rounded">var SECRET_TOKEN = &apos;your_secret_token_here&apos;</code> trong Code.gs thành token của bạn (VD: <code className="bg-gray-100 px-1 rounded">gpmtool2024</code>)</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <div>
              <p className="font-medium text-gray-800">Deploy Web App</p>
              <p className="text-gray-500"><strong>Deploy → New deployment → Web app</strong> — Execute as: <em>Me</em>, Who has access: <em>Anyone</em> → Deploy → Copy URL</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
            <div>
              <p className="font-medium text-gray-800">Dán URL vào trên và Sync</p>
              <p className="text-gray-500">Paste Web App URL và Secret Token vào form trên → Lưu cài đặt → Sync ngay!</p>
            </div>
          </li>
        </ol>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          ⚠️ <strong>Lưu ý:</strong> Sau khi sửa Code.gs, phải tạo <strong>New deployment</strong> mới (không phải edit existing) để thay đổi có hiệu lực.
        </div>
      </div>
    </div>
  )
}
