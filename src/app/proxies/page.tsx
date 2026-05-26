'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Modal from '@/components/Modal'
import ProxyForm from '@/components/ProxyForm'
import BulkImportProxyModal from '@/components/BulkImportProxyModal'
import { useToastContext } from '@/components/ToastProvider'
import { useFilterState } from '@/hooks/useFilterState'

interface Proxy {
  id: string
  label: string
  rawProxy: string
  proxyServerUrl: string | null
  ipBefore: string | null
  ipAfter: string | null
  status: string
  lastCheck: string | null
  lastReset: string | null
  _count: {
    accounts: number
    profiles: number
  }
}

interface BulkCheckProgress {
  total: number
  done: number
  active: number
  dead: number
  error: number
  running: boolean
}

const CONCURRENCY = 3 // max parallel checks

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [allProxies, setAllProxies] = useState<Proxy[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [editingProxyId, setEditingProxyId] = useState<string | null>(null)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProgress, setBulkProgress] = useState<BulkCheckProgress | null>(null)
  const abortRef = useRef(false)

  const { filters, updateFilter } = useFilterState('proxies-filters', {
    searchQuery: '',
    statusFilter: '',
  })
  const searchQuery = filters.searchQuery
  const statusFilter = filters.statusFilter
  const setSearchQuery = (v: string) => updateFilter('searchQuery', v)
  const setStatusFilter = (v: string) => updateFilter('statusFilter', v)

  const { showToast } = useToastContext()

  useEffect(() => {
    fetchProxies()
    const interval = setInterval(fetchProxies, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let filtered = [...allProxies]
    if (statusFilter) filtered = filtered.filter((p) => p.status === statusFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (p) =>
          p.label.toLowerCase().includes(q) ||
          p.rawProxy.toLowerCase().includes(q) ||
          (p.proxyServerUrl && p.proxyServerUrl.toLowerCase().includes(q)) ||
          (p.ipBefore && p.ipBefore.toLowerCase().includes(q)) ||
          (p.ipAfter && p.ipAfter.toLowerCase().includes(q))
      )
    }
    setProxies(filtered)
    // Remove selected IDs that are no longer visible
    setSelectedIds((prev) => {
      const visibleIds = new Set(filtered.map((p) => p.id))
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [allProxies, searchQuery, statusFilter])

  const fetchProxies = async () => {
    try {
      const res = await fetch('/api/proxies')
      const data = await res.json()
      if (data.success) setAllProxies(data.proxies)
    } catch (e) {
      console.error('Error fetching proxies:', e)
    } finally {
      setLoading(false)
    }
  }

  // ── Single check ──────────────────────────────────────────────
  const handleCheck = async (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/proxies/${id}/check`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        const type = data.status === 'error' ? 'error' : data.status === 'dead' ? 'info' : 'success'
        let msg = data.publicIp ? `IP: ${data.publicIp}` : ''
        if (data.message) msg += msg ? ` - ${data.message}` : data.message
        if (data.status) msg += msg ? ` (${data.status})` : `Status: ${data.status}`
        showToast(msg ? `Proxy check: ${msg}` : `Proxy check completed (${data.status})`, type)
      } else {
        showToast(data.error || 'Proxy check failed', 'error')
      }
      fetchProxies()
    } catch {
      showToast('Error checking proxy', 'error')
    } finally {
      setProcessingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  // ── Single reset IP ───────────────────────────────────────────
  const handleResetIp = async (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/proxies/${id}/reset-ip`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast(data.result?.publicIp ? `IP reset. New IP: ${data.result.publicIp}` : 'Proxy IP reset successfully', 'success')
      } else {
        showToast(data.message || 'Reset failed', data.status === 'success' ? 'success' : 'error')
      }
      fetchProxies()
    } catch {
      showToast('Error resetting proxy IP', 'error')
    } finally {
      setProcessingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  // ── Bulk check selected ───────────────────────────────────────
  const handleBulkCheck = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return

    abortRef.current = false
    const prog: BulkCheckProgress = { total: ids.length, done: 0, active: 0, dead: 0, error: 0, running: true }
    setBulkProgress({ ...prog })

    // Mark all as processing
    setProcessingIds((prev) => { const n = new Set(prev); ids.forEach((id) => n.add(id)); return n })

    let idx = 0
    let inFlight = 0

    await new Promise<void>((resolve) => {
      const next = () => {
        if (abortRef.current) { resolve(); return }
        if (idx >= ids.length && inFlight === 0) { resolve(); return }
        while (inFlight < CONCURRENCY && idx < ids.length) {
          const id = ids[idx++]
          inFlight++
          fetch(`/api/proxies/${id}/check`, { method: 'POST' })
            .then((r) => r.json())
            .then((data) => {
              if (!abortRef.current) {
                prog.done++
                if (data.success) {
                  if (data.status === 'active') prog.active++
                  else if (data.status === 'dead') prog.dead++
                  else prog.error++
                } else {
                  prog.error++
                }
                setBulkProgress({ ...prog })
              }
            })
            .catch(() => { if (!abortRef.current) { prog.done++; prog.error++; setBulkProgress({ ...prog }) } })
            .finally(() => {
              inFlight--
              setProcessingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
              next()
            })
        }
      }
      next()
    })

    prog.running = false
    setBulkProgress({ ...prog })
    showToast(
      `Check xong ${prog.total} proxies: ✅ ${prog.active} active, ☠ ${prog.dead} dead, ⚠ ${prog.error} error`,
      prog.error > 0 ? 'error' : 'success'
    )
    fetchProxies()
  }, [selectedIds, showToast])

  // ── Bulk delete selected ──────────────────────────────────────
  const handleBulkDelete = async () => {
    const ids = [...selectedIds]
    if (!confirm(`Xóa ${ids.length} proxy đã chọn?`)) return
    let ok = 0, fail = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/proxies/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (data.success) ok++ else fail++
      } catch { fail++ }
    }
    showToast(`Đã xóa ${ok} proxy${fail > 0 ? `, thất bại ${fail}` : ''}`, fail > 0 ? 'error' : 'success')
    setSelectedIds(new Set())
    fetchProxies()
  }

  // ── Select helpers ────────────────────────────────────────────
  const allVisibleSelected = proxies.length > 0 && proxies.every((p) => selectedIds.has(p.id))
  const someSelected = selectedIds.size > 0

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(proxies.map((p) => p.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      dead: 'bg-red-100 text-red-800',
      checking: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  if (loading) return <div className="text-center py-12">Loading...</div>

  const progressPct = bulkProgress ? Math.round((bulkProgress.done / bulkProgress.total) * 100) : 0

  return (
    <div className="w-full px-4 sm:px-0">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Proxies</h1>

      {/* Filter / Action bar */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-3 items-end lg:items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px] w-full lg:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1">🔍 Tìm kiếm</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo label, proxy, IP, server URL..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status filter */}
          <div className="w-full lg:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">📊 Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tất cả</option>
              <option value="active">Active</option>
              <option value="dead">Dead</option>
              <option value="checking">Checking</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Count */}
          <div className="text-sm text-gray-600 whitespace-nowrap">
            <span className="font-semibold">{proxies.length}</span> / {allProxies.length}
          </div>

          {(searchQuery || statusFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('') }}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors whitespace-nowrap"
            >🗑️ Xóa lọc</button>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={fetchProxies} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
              🔄 Refresh
            </button>
            <button onClick={() => setShowBulkImportModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
              📥 Bulk Import
            </button>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
              + Add Proxy
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action bar — visible when rows selected */}
      {someSelected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-blue-700">
            ✅ Đã chọn {selectedIds.size} proxy
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-blue-500 hover:underline"
          >
            Bỏ chọn tất cả
          </button>
          <div className="flex-1" />

          {/* Bulk check */}
          {bulkProgress?.running ? (
            <button
              onClick={() => { abortRef.current = true }}
              className="px-4 py-1.5 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
            >
              ⏹ Dừng
            </button>
          ) : (
            <button
              onClick={handleBulkCheck}
              disabled={!!bulkProgress?.running}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              🔍 Check trạng thái ({selectedIds.size})
            </button>
          )}

          {/* Bulk delete */}
          <button
            onClick={handleBulkDelete}
            disabled={bulkProgress?.running}
            className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            🗑️ Xóa ({selectedIds.size})
          </button>
        </div>
      )}

      {/* Bulk check progress bar */}
      {bulkProgress && (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-700">
              {bulkProgress.running ? `⏳ Đang check... ${bulkProgress.done}/${bulkProgress.total}` : `✅ Hoàn tất ${bulkProgress.total} proxy`}
            </span>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green-600 font-semibold">✅ {bulkProgress.active}</span>
              <span className="text-red-500 font-semibold">☠ {bulkProgress.dead}</span>
              <span className="text-yellow-600 font-semibold">⚠ {bulkProgress.error}</span>
              {!bulkProgress.running && (
                <button onClick={() => setBulkProgress(null)} className="text-gray-400 hover:text-gray-600 ml-1">✕</button>
              )}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${bulkProgress.running ? 'bg-blue-500' : 'bg-green-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {!bulkProgress.running && (
            <p className="text-xs text-gray-500 mt-1">{progressPct}% — {bulkProgress.active} active / {bulkProgress.dead} dead / {bulkProgress.error} error</p>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* Select-all checkbox */}
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allVisibleSelected }}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title="Chọn tất cả"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Label</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Raw Proxy</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Server URL</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">IP Before</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">IP After</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Used By</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Last Check</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40 sticky right-0 bg-gray-50">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proxies.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-sm text-gray-500">
                      Không có proxy nào. Click &quot;+ Add Proxy&quot; hoặc &quot;📥 Bulk Import&quot; để thêm.
                    </td>
                  </tr>
                ) : (
                  proxies.map((proxy) => {
                    const isSelected = selectedIds.has(proxy.id)
                    const isProcessing = processingIds.has(proxy.id)
                    return (
                      <tr
                        key={proxy.id}
                        className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                        onClick={() => toggleSelect(proxy.id)}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2 w-8" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(proxy.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 border-b border-gray-100">
                          {proxy.label}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                          <div className="max-w-[180px] truncate" title={proxy.rawProxy}>{proxy.rawProxy}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                          <div className="max-w-[140px] truncate" title={proxy.proxyServerUrl || ''}>{proxy.proxyServerUrl || '-'}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 font-mono border-b border-gray-100">{proxy.ipBefore || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 font-mono font-semibold border-b border-gray-100">{proxy.ipAfter || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap border-b border-gray-100">
                          {isProcessing
                            ? <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 animate-pulse">checking…</span>
                            : getStatusBadge(proxy.status)
                          }
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 border-b border-gray-100">
                          <div className="flex flex-col">
                            <span>{proxy._count.accounts} acc</span>
                            <span>{proxy._count.profiles} prof</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 border-b border-gray-100">
                          {proxy.lastCheck
                            ? new Date(proxy.lastCheck).toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </td>
                        <td
                          className="px-3 py-2 whitespace-nowrap text-sm font-medium sticky right-0 bg-white z-10 hover:bg-gray-50 border-l border-b border-gray-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              onClick={() => handleCheck(proxy.id)}
                              disabled={isProcessing}
                              className="px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 border border-blue-200 rounded disabled:opacity-50 transition-colors"
                              title="Kiểm tra proxy"
                            >
                              {isProcessing ? '⏳' : '🔍'}
                            </button>
                            <button
                              onClick={() => handleResetIp(proxy.id)}
                              disabled={isProcessing}
                              className="px-1.5 py-0.5 text-[10px] text-green-600 hover:bg-green-50 border border-green-200 rounded disabled:opacity-50 transition-colors"
                              title="Reset IP"
                            >
                              {isProcessing ? '⏳' : '🔄'}
                            </button>
                            <button
                              onClick={() => setEditingProxyId(proxy.id)}
                              className="px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 border border-gray-200 rounded transition-colors"
                              title="Chỉnh sửa"
                            >✏️</button>
                            <button
                              onClick={async () => {
                                if (confirm(`Xóa proxy "${proxy.label}"?`)) {
                                  try {
                                    const res = await fetch(`/api/proxies/${proxy.id}`, { method: 'DELETE' })
                                    const data = await res.json()
                                    if (data.success) { showToast('Proxy deleted', 'success'); fetchProxies() }
                                    else showToast(data.error || 'Delete failed', 'error')
                                  } catch { showToast('Error deleting proxy', 'error') }
                                }
                              }}
                              className="px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50 border border-red-200 rounded transition-colors"
                              title="Xóa proxy"
                            >🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal || editingProxyId !== null}
        onClose={() => { setShowAddModal(false); setEditingProxyId(null) }}
        title={editingProxyId ? 'Edit Proxy' : 'Add Proxy'}
      >
        <ProxyForm
          isOpen={showAddModal || editingProxyId !== null}
          onClose={() => { setShowAddModal(false); setEditingProxyId(null) }}
          onSuccess={fetchProxies}
          proxyId={editingProxyId || undefined}
        />
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        title="📥 Bulk Import Proxies"
        size="lg"
      >
        <BulkImportProxyModal
          onClose={() => setShowBulkImportModal(false)}
          onSuccess={fetchProxies}
        />
      </Modal>
    </div>
  )
}
