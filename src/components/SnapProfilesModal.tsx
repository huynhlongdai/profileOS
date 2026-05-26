'use client'

import { useEffect, useState, useCallback } from 'react'

export interface SnapProfile {
  id: string
  name: string
  profileUid: string
  status: string
  browserType: string | null
  proxy?: { id: string; label: string; rawProxy: string } | null
  _count?: { accounts: number }
}

interface SnapProfilesModalProps {
  isOpen: boolean
  onClose: () => void
  accountTypes: { id: string; name: string; label: string; icon: string | null }[]
  /** Called with the list of selected profiles when user confirms */
  onSnap: (profiles: SnapProfile[], defaultType: string, defaultLoginMethod: string) => void
}

export default function SnapProfilesModal({ isOpen, onClose, onSnap, accountTypes }: SnapProfilesModalProps) {
  const [profiles, setProfiles] = useState<SnapProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const [defaultType, setDefaultType] = useState('gmail')
  const [defaultLogin, setDefaultLogin] = useState('PASSWORD')

  const fetchOpenProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch both running and starting profiles
      const [runningRes, startingRes] = await Promise.all([
        fetch('/api/profiles?status=running'),
        fetch('/api/profiles?status=starting'),
      ])
      const [runningData, startingData] = await Promise.all([
        runningRes.json(),
        startingRes.json(),
      ])

      const running: SnapProfile[] = runningData.success ? runningData.profiles : []
      const starting: SnapProfile[] = startingData.success ? startingData.profiles : []

      // Merge & deduplicate
      const seen = new Set<string>()
      const merged: SnapProfile[] = []
      for (const p of [...running, ...starting]) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          merged.push(p)
        }
      }

      setProfiles(merged)
      setLastRefresh(new Date())

      // Auto-select all by default
      setSelectedIds(new Set(merged.map((p) => p.id)))
    } catch (e: any) {
      setError(e.message || 'Không thể tải danh sách profile')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchOpenProfiles()
    } else {
      // Reset on close
      setProfiles([])
      setSelectedIds(new Set())
      setError(null)
    }
  }, [isOpen, fetchOpenProfiles])

  if (!isOpen) return null

  const allSelected = profiles.length > 0 && selectedIds.size === profiles.length
  const noneSelected = selectedIds.size === 0

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(profiles.map((p) => p.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSnap = () => {
    const chosen = profiles.filter((p) => selectedIds.has(p.id))
    onSnap(chosen, defaultType, defaultLogin)
    onClose()
  }

  const getBrowserIcon = (browserType: string | null | undefined) => {
    if (!browserType) return '🌐'
    const t = browserType.toLowerCase()
    if (t === 'chromium' || t === 'chrome') return '🟡'
    if (t === 'firefox') return '🦊'
    if (t === 'gpm') return '🟢'
    return '🌐'
  }

  const getStatusDot = (status: string) => {
    if (status === 'running') return <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Running" />
    if (status === 'starting') return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Starting" />
    return <span className="inline-block w-2 h-2 rounded-full bg-gray-300" title={status} />
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal box */}
      <div
        className="relative bg-white rounded-xl shadow-2xl flex flex-col"
        style={{ width: 560, maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-t-xl">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-xl">📸</span> Snap từ Profiles Đang Mở
            </h2>
            <p className="text-xs text-violet-200 mt-0.5">
              Chọn các profiles để tự động tạo dòng Quick Add
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors text-xl leading-none"
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Đang tải danh sách profiles...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 px-6">
              <span className="text-3xl">⚠️</span>
              <p className="text-sm text-red-600 text-center">{error}</p>
              <button
                onClick={fetchOpenProfiles}
                className="mt-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                Thử lại
              </button>
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-6">
              <span className="text-4xl">😴</span>
              <p className="text-sm font-medium text-gray-700">Không có profile nào đang mở</p>
              <p className="text-xs text-gray-400 text-center">
                Hãy mở các profile trong GPMLogin trước, sau đó nhấn Làm mới.
              </p>
              <button
                onClick={fetchOpenProfiles}
                className="mt-2 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-1.5"
              >
                🔄 Làm mới
              </button>
            </div>
          ) : (
            <>
              {/* Select all bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && selectedIds.size > 0 }}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-violet-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                    {profiles.length} profile đang mở
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-violet-600 font-semibold">
                    {selectedIds.size} đã chọn
                  </span>
                  <button
                    onClick={fetchOpenProfiles}
                    disabled={loading}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1.5 py-1 rounded hover:bg-gray-100"
                    title="Làm mới danh sách"
                  >
                    🔄
                  </button>
                </div>
              </div>

              {/* Profile list */}
              <ul className="divide-y divide-gray-100">
                {profiles.map((profile) => {
                  const isChecked = selectedIds.has(profile.id)
                  return (
                    <li
                      key={profile.id}
                      onClick={() => toggleOne(profile.id)}
                      className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors select-none ${
                        isChecked
                          ? 'bg-violet-50 hover:bg-violet-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(profile.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-violet-600 cursor-pointer flex-shrink-0"
                      />

                      {/* Status dot */}
                      <span className="flex-shrink-0">{getStatusDot(profile.status)}</span>

                      {/* Browser icon */}
                      <span className="text-base flex-shrink-0">{getBrowserIcon(profile.browserType)}</span>

                      {/* Profile info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium truncate ${isChecked ? 'text-violet-800' : 'text-gray-800'}`}>
                            {profile.name}
                          </span>
                          {profile._count && profile._count.accounts > 0 && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {profile._count.accounts} acc
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-400 font-mono">
                            {profile.profileUid}
                          </span>
                          {profile.proxy && (
                            <span className="text-[11px] text-blue-500 truncate" title={profile.proxy.rawProxy}>
                              🔗 {profile.proxy.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        profile.status === 'running'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {profile.status === 'running' ? 'Running' : 'Starting'}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {lastRefresh && (
                <p className="text-[11px] text-gray-300 text-center py-2">
                  Cập nhật lúc {lastRefresh.toLocaleTimeString('vi-VN')}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {/* Quick Settings Bar */}
          <div className="flex flex-wrap items-center gap-4 py-2 border-b border-gray-200 border-dashed pb-3">
            <span className="text-xs font-semibold text-gray-700">Tùy chọn tạo nhanh:</span>
            
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Type:</label>
              <select
                value={defaultType}
                onChange={(e) => setDefaultType(e.target.value)}
                className="text-xs rounded border border-gray-300 bg-white px-2 py-1 outline-none focus:border-violet-500"
              >
                {accountTypes.map(t => (
                  <option key={t.id} value={t.name}>{t.icon ? `${t.icon} ` : ''}{t.label}</option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Login Mode:</label>
              <select
                value={defaultLogin}
                onChange={(e) => setDefaultLogin(e.target.value)}
                className="text-xs rounded border border-gray-300 bg-white px-2 py-1 outline-none focus:border-violet-500"
              >
                <option value="PASSWORD">Password</option>
                <option value="AUTHENTICATOR">Authenticator</option>
                <option value="GOOGLE_OAUTH">Google OAuth</option>
                <option value="X_OAUTH">X OAuth</option>
                <option value="DISCORD_OAUTH">Discord OAuth</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-gray-500">
              {noneSelected
                ? 'Chưa chọn profile nào'
                : `Sẽ tạo ${selectedIds.size} dòng Quick Add`}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSnap}
                disabled={noneSelected}
                className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <span>📸</span>
                Snap {selectedIds.size > 0 ? `${selectedIds.size} Profiles` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
