'use client'

import { useState } from 'react'
import { useToastContext } from './ToastProvider'

export type ProxyType = 'http' | 'https' | 'socks4' | 'socks5'

interface BulkImportProxyModalProps {
  onClose: () => void
  onSuccess: () => void
}

const PROXY_TYPES: { value: ProxyType; label: string; description: string }[] = [
  { value: 'http', label: 'HTTP Proxy', description: 'Giao thức HTTP tiêu chuẩn' },
  { value: 'https', label: 'HTTPS Proxy', description: 'HTTP với SSL/TLS' },
  { value: 'socks4', label: 'SOCKS4', description: 'SOCKS4 – không hỗ trợ UDP' },
  { value: 'socks5', label: 'SOCKS5', description: 'SOCKS5 – hỗ trợ TCP, UDP, IPv6' },
]

const FORMAT_EXAMPLES: Record<ProxyType, string[]> = {
  http: [
    '192.168.1.1:8080',
    '192.168.1.1:8080:user:pass',
    'user:pass@192.168.1.1:8080',
    'http://192.168.1.1:8080',
  ],
  https: [
    '192.168.1.1:8443',
    '192.168.1.1:8443:user:pass',
    'https://user:pass@192.168.1.1:8443',
  ],
  socks4: [
    '192.168.1.1:1080',
    '192.168.1.1:1080:user:pass',
    'socks4://192.168.1.1:1080',
  ],
  socks5: [
    '192.168.1.1:1080',
    '192.168.1.1:1080:user:pass',
    'user:pass@192.168.1.1:1080',
    'socks5://user:pass@192.168.1.1:1080',
  ],
}

interface ImportResult {
  summary: {
    total: number
    imported: number
    duplicates: number
    failed: number
  }
  results: { line: string; success: boolean; label?: string; error?: string }[]
}

export default function BulkImportProxyModal({ onClose, onSuccess }: BulkImportProxyModalProps) {
  const [proxyType, setProxyType] = useState<ProxyType>('http')
  const [proxyText, setProxyText] = useState('')
  const [proxyServerUrl, setProxyServerUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showExamples, setShowExamples] = useState(false)
  const { showToast } = useToastContext()

  const lineCount = proxyText.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length

  const handleImport = async () => {
    if (!proxyText.trim()) {
      showToast('Vui lòng nhập danh sách proxy', 'error')
      return
    }
    setLoading(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/proxies/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxyType,
          proxies: proxyText,
          proxyServerUrl: proxyServerUrl.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setImportResult(data)
        if (data.summary.imported > 0) {
          onSuccess()
          showToast(
            `Import thành công ${data.summary.imported}/${data.summary.total} proxies`,
            'success'
          )
        } else {
          showToast('Không có proxy nào được import', 'info' as any)
        }
      } else {
        showToast(data.error || 'Import thất bại', 'error')
      }
    } catch (err) {
      showToast('Lỗi kết nối server', 'error')
    } finally {
      setLoading(false)
    }
  }

  const selectedType = PROXY_TYPES.find((t) => t.value === proxyType)!

  return (
    <div className="flex flex-col gap-4">
      {/* Proxy Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          🌐 Loại Proxy
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PROXY_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setProxyType(type.value)}
              className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                proxyType === type.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">{selectedType.description}</p>
      </div>

      {/* Format examples toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowExamples((v) => !v)}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          {showExamples ? '▾' : '▸'} Xem format hợp lệ cho {selectedType.label}
        </button>
        {showExamples && (
          <div className="mt-1.5 rounded-md bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs text-gray-500 mb-1.5 font-medium">Định dạng được hỗ trợ:</p>
            <ul className="space-y-1">
              {FORMAT_EXAMPLES[proxyType].map((ex) => (
                <li key={ex} className="text-xs font-mono text-gray-700">
                  • {ex}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-2">Mỗi proxy trên một dòng. Dòng bắt đầu bằng # sẽ bị bỏ qua.</p>
          </div>
        )}
      </div>

      {/* Proxy textarea */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">
            📋 Danh sách Proxy
          </label>
          <span className="text-xs text-gray-400">
            {lineCount > 0 ? `${lineCount} dòng` : 'Chưa có dữ liệu'}
          </span>
        </div>
        <textarea
          value={proxyText}
          onChange={(e) => setProxyText(e.target.value)}
          rows={10}
          placeholder={`Nhập danh sách proxy, mỗi proxy một dòng...\n\nVí dụ:\n${FORMAT_EXAMPLES[proxyType][0]}\n${FORMAT_EXAMPLES[proxyType][1] || ''}`}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          disabled={loading}
        />
      </div>

      {/* Optional: Proxy Server URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          🖥️ Proxy Server URL <span className="text-gray-400 font-normal">(tùy chọn)</span>
        </label>
        <input
          type="text"
          value={proxyServerUrl}
          onChange={(e) => setProxyServerUrl(e.target.value)}
          placeholder="http://192.168.1.41 (dùng chung cho tất cả proxies)"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500">
          URL API server để check và reset IP. Nếu để trống sẽ dùng giá trị mặc định từ cấu hình.
        </p>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          {/* Summary bar */}
          <div className="grid grid-cols-4 divide-x divide-gray-200 bg-gray-50">
            <div className="px-3 py-2 text-center">
              <p className="text-xs text-gray-500">Tổng</p>
              <p className="text-lg font-bold text-gray-800">{importResult.summary.total}</p>
            </div>
            <div className="px-3 py-2 text-center">
              <p className="text-xs text-green-600">Thành công</p>
              <p className="text-lg font-bold text-green-600">{importResult.summary.imported}</p>
            </div>
            <div className="px-3 py-2 text-center">
              <p className="text-xs text-yellow-600">Trùng lặp</p>
              <p className="text-lg font-bold text-yellow-600">{importResult.summary.duplicates}</p>
            </div>
            <div className="px-3 py-2 text-center">
              <p className="text-xs text-red-500">Lỗi</p>
              <p className="text-lg font-bold text-red-500">{importResult.summary.failed}</p>
            </div>
          </div>
          {/* Failed details */}
          {importResult.results.filter((r) => !r.success).length > 0 && (
            <div className="border-t border-gray-200 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-gray-600 px-3 pt-2 pb-1">Chi tiết lỗi:</p>
              {importResult.results
                .filter((r) => !r.success)
                .map((r, i) => (
                  <div key={i} className="px-3 py-1 flex items-start gap-2 hover:bg-gray-50">
                    <span className="text-red-400 text-xs mt-0.5 shrink-0">✗</span>
                    <span className="text-xs font-mono text-gray-600 truncate">{r.line}</span>
                    <span className="text-xs text-red-500 ml-auto shrink-0">— {r.error}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          {importResult ? 'Đóng' : 'Hủy'}
        </button>
        {!importResult && (
          <button
            type="button"
            onClick={handleImport}
            disabled={loading || lineCount === 0}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Đang import...
              </>
            ) : (
              <>📥 Import {lineCount > 0 ? `(${lineCount})` : ''}</>
            )}
          </button>
        )}
        {importResult && importResult.summary.failed + importResult.summary.duplicates > 0 && (
          <button
            type="button"
            onClick={() => {
              // Keep only failed lines in textarea for retry
              const failedLines = importResult.results
                .filter((r) => !r.success && r.error !== 'Duplicate (already exists)')
                .map((r) => r.line)
                .join('\n')
              setProxyText(failedLines)
              setImportResult(null)
            }}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
          >
            🔄 Thử lại lỗi
          </button>
        )}
      </div>
    </div>
  )
}
