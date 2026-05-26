'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useToastContext } from '@/components/ToastProvider'
import Modal from '@/components/Modal'
import ProfileForm from '@/components/ProfileForm'
import ProfileExtensionsModal from '@/components/ProfileExtensionsModal'
import ProfileDetailModal from '@/components/ProfileDetailModal'
import LiveViewer from '@/components/live-view/LiveViewer'
import { useFilterState } from '@/hooks/useFilterState'
import ProxySelector from '@/components/ProxySelector'

interface Profile {
  id: string
  name: string
  profileUid: string
  status: string
  lastOpened: string | null
  lastClosed: string | null
  autoResetIp: boolean
  groupId: number | null
  browserType: string | null
  browserProvider: string | null
  remoteDebuggingPort?: number | null
  proxy: { id: string; label: string; rawProxy: string } | null
  connection?: { id: string; name: string; apiUrl: string; providerType: string } | null
  _count?: { accounts: number }
}

interface Group {
  id: number
  name: string
  sort?: number
}

interface AccountType {
  id: string
  name: string
  label: string
  icon: string | null
  isActive: boolean
  sortOrder: number
}

export default function ProfilesPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ProfilesContent />
    </Suspense>
  )
}

function ProfilesContent() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [connections, setConnections] = useState<any[]>([])
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])
  const [loading, setLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [liveViewProfile, setLiveViewProfile] = useState<{ id: string, port: number } | null>(null)
  const [highlightedProfileId, setHighlightedProfileId] = useState<string | null>(null)
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null)
  const searchParams = useSearchParams()

  // Use filter state hook with localStorage persistence
  const {
    filters,
    updateFilter,
    setFilters,
  } = useFilterState('profiles-filters', {
    searchQuery: '',
    statusFilter: '',
    groupFilter: '',
    browserType: '',
    accountType: '',
    browserConnectionId: '',
    currentPage: 1,
    perPage: 10,
  })

  const searchQuery = filters.searchQuery
  const statusFilter = filters.statusFilter
  const groupFilter = filters.groupFilter
  const currentPage = filters.currentPage
  const perPage = filters.perPage

  // Update filter state when changing filters
  const setSearchQuery = (value: string) => updateFilter('searchQuery', value)
  const setStatusFilter = (value: string) => updateFilter('statusFilter', value)
  const setGroupFilter = (value: string) => updateFilter('groupFilter', value)
  const setCurrentPage = (value: number) => updateFilter('currentPage', value)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProfileId, setEditingProfileId] = useState<string | undefined>()
  const [detailsProfileId, setDetailsProfileId] = useState<string | null>(null)
  const [extensionsProfileId, setExtensionsProfileId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null) // Track which sync is running
  const [showSyncMenu, setShowSyncMenu] = useState(false)
  const { showToast } = useToastContext()

  const handleSync = async (connectionId?: string, browserProvider?: string) => {
    setSyncing(connectionId || browserProvider || 'all')
    try {
      const params = new URLSearchParams()
      if (connectionId) params.append('connectionId', connectionId)
      if (browserProvider) params.append('browserProvider', browserProvider)
      
      const res = await fetch(`/api/profiles/sync?${params.toString()}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast('Sync completed successfully', 'success')
        fetchProfiles()
      } else {
        showToast(data.error || 'Sync failed', 'error')
      }
    } catch (error) {
      console.error('Sync error:', error)
      showToast('Sync failed', 'error')
    } finally {
      setSyncing(null)
    }
  }

  const fetchProfiles = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (groupFilter) params.append('groupId', groupFilter)
      if (statusFilter) params.append('status', statusFilter)
      if (searchQuery) params.append('search', searchQuery)
      if (filters.browserType) params.append('browserType', filters.browserType)
      if (filters.accountType) params.append('accountType', filters.accountType)
      if (filters.browserConnectionId) params.append('browserConnectionId', filters.browserConnectionId)

      const url = `/api/profiles${params.toString() ? `?${params.toString()}` : ''}`

      const res = await fetch(url)
      const data = await res.json()

      if (data.success) {
        setAllProfiles(data.profiles)
        setProfiles(data.profiles)
      }
    } catch (error) {
      console.error('Error fetching profiles:', error)
    } finally {
      setLoading(false)
    }
  }, [groupFilter, statusFilter, searchQuery, filters.browserType, filters.accountType, filters.browserConnectionId])

  useEffect(() => {
    fetchAccountTypes()
    fetchProfiles()
    fetchGroups()
    fetchConnections()
  }, [fetchProfiles])

  // Handle profileId URL param: highlight and scroll to that profile
  useEffect(() => {
    const profileId = searchParams.get('profileId')
    if (!profileId || loading || allProfiles.length === 0) return

    const target = allProfiles.find((p) => p.id === profileId)
    if (!target) return

    // Set search to profile name to make it visible
    setSearchQuery(target.name)
    setHighlightedProfileId(profileId)

    // Scroll to highlighted row after render
    setTimeout(() => {
      if (highlightedRowRef.current) {
        highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      // Remove highlight after 3 seconds
      setTimeout(() => setHighlightedProfileId(null), 3000)
    }, 200)
  }, [searchParams, allProfiles, loading])

  // Dynamic polling based on processing state
  useEffect(() => {
    // Check if any profile is in a processing state
    const hasProcessingProfiles = profiles.some(p => 
      ['starting', 'changing_proxy', 'opening_browser', 'stopping'].includes(p.status)
    ) || processingIds.size > 0

    // Set polling interval: 1.5 seconds if processing, 30 seconds otherwise
    const intervalTime = hasProcessingProfiles ? 1500 : 30000

    const interval = setInterval(() => {
      fetchProfiles()
    }, intervalTime)

    return () => clearInterval(interval)
  }, [fetchProfiles, profiles, processingIds.size])

  // Calculate pagination
  const totalPages = Math.ceil(profiles.length / perPage)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const paginatedProfiles = profiles.slice(startIndex, endIndex)

  const fetchAccountTypes = async () => {
    try {
      const res = await fetch('/api/account-types')
      const data = await res.json()
      if (data.success && data.accountTypes) {
        // Filter only active account types and sort by sortOrder
        const activeTypes = data.accountTypes
          .filter((type: AccountType) => type.isActive)
          .sort((a: AccountType, b: AccountType) => {
            // Sort by sortOrder first, then by label
            if (a.sortOrder !== b.sortOrder) {
              return a.sortOrder - b.sortOrder
            }
            return a.label.localeCompare(b.label)
          })
        setAccountTypes(activeTypes)
      }
    } catch (error) {
      console.error('Error fetching account types:', error)
    }
  }

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups')
      const data = await res.json()
      if (data.success) {
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/browser-connections')
      const data = await res.json()
      if (data.success) {
        setConnections(data.connections || [])
      }
    } catch (error) {
      console.error('Error fetching connections:', error)
    }
  }

  // Verify status of running profiles to detect if they were closed externally
  const verifyRunningProfiles = async (profiles: Profile[]) => {
    const runningProfiles = profiles.filter(p => p.status === 'running')
    if (runningProfiles.length === 0) return

    console.log('[Profiles Page] Verifying status of', runningProfiles.length, 'running profiles')

    try {
      const res = await fetch('/api/profiles/verify-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileIds: runningProfiles.map(p => p.id),
        }),
      })

      const data = await res.json()
      if (data.success && data.updatedCount > 0) {
        console.log('[Profiles Page] Status verification updated', data.updatedCount, 'profiles')
        // Re-fetch profiles to get updated status
        fetchProfiles()
      }
    } catch (error) {
      console.error('[Profiles Page] Error verifying profile status:', error)
    }
  }

  // Auto-verify running profiles when allProfiles changes
  useEffect(() => {
    if (!loading && allProfiles.length > 0) {
      verifyRunningProfiles(allProfiles)
    }
  }, [allProfiles.length]) // Only run when profile count changes, not on every allProfiles update

  const handleStart = async (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/profiles/${id}/start`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        const port = data.profile?.remoteDebuggingPort
        showToast(
          port
            ? `Profile started successfully (Port: ${port})`
            : 'Profile started successfully',
          'success'
        )
      } else {
        console.error('Start profile error:', data.error)
        showToast(data.error || 'Failed to start profile', 'error')
      }
      fetchProfiles()
    } catch (error) {
      console.error('Error starting profile:', error)
      showToast(
        error instanceof Error ? error.message : 'Error starting profile',
        'error'
      )
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleStop = async (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/profiles/${id}/stop`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast('Profile stopped successfully', 'success')
      } else {
        showToast(data.error || 'Failed to stop profile', 'error')
      }
      fetchProfiles()
    } catch (error) {
      console.error('Error stopping profile:', error)
      showToast('Error stopping profile', 'error')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleBulkStart = async () => {
    if (selectedIds.size === 0) {
      showToast('Please select at least one profile', 'info')
      return
    }

    const ids = Array.from(selectedIds)
    setProcessingIds((prev) => new Set([...prev, ...ids]))

    try {
      const res = await fetch('/api/profiles/bulk-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds: ids }),
      })
      const data = await res.json()

      if (data.success) {
        showToast(
          `Started ${data.succeeded}/${data.total} profiles${data.failed > 0 ? ` (${data.failed} failed)` : ''}`,
          data.failed > 0 ? 'info' : 'success'
        )
        setSelectedIds(new Set())
      } else {
        showToast(data.error || 'Bulk start failed', 'error')
      }
      fetchProfiles()
    } catch (error) {
      console.error('Error bulk starting profiles:', error)
      showToast('Error bulk starting profiles', 'error')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
    }
  }

  const handleBulkStop = async () => {
    if (selectedIds.size === 0) {
      showToast('Please select at least one profile', 'info')
      return
    }

    const ids = Array.from(selectedIds)
    setProcessingIds((prev) => new Set([...prev, ...ids]))

    try {
      const res = await fetch('/api/profiles/bulk-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds: ids }),
      })
      const data = await res.json()

      if (data.success) {
        showToast(
          `Stopped ${data.succeeded}/${data.total} profiles${data.failed > 0 ? ` (${data.failed} failed)` : ''}`,
          data.failed > 0 ? 'info' : 'success'
        )
        setSelectedIds(new Set())
      } else {
        showToast(data.error || 'Bulk stop failed', 'error')
      }
      fetchProfiles()
    } catch (error) {
      console.error('Error bulk stopping profiles:', error)
      showToast('Error bulk stopping profiles', 'error')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(profiles.map((p) => p.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => new Set(prev).add(id))
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      running: 'bg-green-500 text-white border border-green-600 shadow-sm',
      idle: 'bg-gray-600 text-white border border-gray-700 shadow-sm',
      starting: 'bg-yellow-500 text-white border border-yellow-600 shadow-sm',
      stopping: 'bg-yellow-500 text-white border border-yellow-600 shadow-sm',
      changing_proxy: 'bg-yellow-400 text-yellow-900 border border-yellow-500 shadow-sm animate-pulse',
      opening_browser: 'bg-yellow-400 text-yellow-900 border border-yellow-500 shadow-sm animate-pulse',
      error: 'bg-red-500 text-white border border-red-600 shadow-sm',
    }

    // Custom labels for detailed statuses
    const labels: Record<string, string> = {
      changing_proxy: 'ĐỔI PROXY...',
      opening_browser: 'MỞ BROWSER...',
    }

    return (
      <span
        className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-full whitespace-nowrap inline-flex items-center justify-center min-w-[80px] ${colors[status] || 'bg-gray-600 text-white border border-gray-700 shadow-sm'
          }`}
      >
        {labels[status] || status.toUpperCase()}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
        <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-9 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-surface-2)' }} />)}
          </div>
        </div>
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 border-b animate-pulse" style={{ backgroundColor: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-2)', borderColor: 'var(--border-color)' }} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-4 sm:px-0">
      {/* Title and Action Buttons */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Profiles</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchProfiles}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)', border: '1px solid var(--border-color)' }}
            title="Làm mới danh sách"
          >
            🔄 Refresh
          </button>

          <button
            onClick={async () => {
              if (!confirm('Bạn có chắc muốn cập nhật tất cả profiles thành GPM Browser? Các profiles có browserType là Chrome hoặc null sẽ được đổi thành GPM.')) {
                return
              }
              try {
                showToast('Đang cập nhật browser type...', 'info')
                const res = await fetch('/api/profiles/fix-browser-type', { method: 'POST' })
                const data = await res.json()
                if (data.success) {
                  showToast(
                    `Đã cập nhật ${data.updatedCount} profiles thành GPM Browser`,
                    'success'
                  )
                  fetchProfiles()
                } else {
                  showToast(data.error || 'Update failed', 'error')
                }
              } catch (error) {
                console.error('Error fixing browser types:', error)
                showToast('Error fixing browser types', 'error')
              }
            }}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs font-medium"
            title="Cập nhật browser type cho tất cả profiles thành GPM"
          >
            🔧 Fix Browser
          </button>

          {/* Sync Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSyncMenu(!showSyncMenu)}
              disabled={!!syncing}
              className="px-3 py-1.5 text-white rounded-lg transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {syncing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  {syncing === 'all' ? 'Đang sync...' : syncing === 'chromium' ? 'Đang sync Chrome...' : 'Đang sync Firefox...'}
                </>
              ) : (
                <>
                  🔄 Sync Profiles
                  <span className="text-xs">▼</span>
                </>
              )}
            </button>

            {showSyncMenu && !syncing && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSyncMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-20 py-1" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                  <button
                    onClick={() => handleSync('', 'gpmlogin_global')}
                    className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-white/5 transition-colors border-b group" style={{ borderColor: 'var(--border-color)' }}
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">🌍</span>
                    <div className="flex flex-col">
                      <span className="font-bold" style={{ color: 'var(--accent)' }}>Sync GPMLogin Global</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Port 9495 • API v1</span>
                    </div>
                  </button>

                  {/* Dynamically list GPMLogin connections */}
                  {connections.filter(c => c.providerType === 'gpmlogin').map(conn => (
                    <button
                      key={conn.id}
                      onClick={() => handleSync(conn.id)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center gap-2"
                    >
                      <span>📡</span> Sync from {conn.name}
                    </button>
                  ))}

                  <div className="border-t my-1"></div>

                  <button
                    onClick={() => handleSync('', 'chromium')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center gap-2"
                  >
                    <span>🌐</span> Sync Chrome Only
                  </button>
                  <button
                    onClick={() => handleSync('', 'firefox')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center gap-2"
                  >
                    <span>🦊</span> Sync Firefox Only
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-medium"
          >
            + Add Profile
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <div className="flex flex-col lg:flex-row gap-3 items-end lg:items-center">
          {/* Search Input */}
          <div className="flex-1 min-w-[200px] w-full lg:w-auto">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              🔍 Tìm kiếm
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, UID, proxy..."
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Status Filter */}
          <div className="w-full lg:w-48">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              📊 Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} data-dark="true"
            >
              <option value="">Tất cả</option>
              <option value="idle">Idle</option>
              <option value="running">Running</option>
              <option value="starting">Starting</option>
              <option value="changing_proxy">Changing Proxy...</option>
              <option value="opening_browser">Opening Browser...</option>
              <option value="stopping">Stopping</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Connection Filter */}
          <div className="w-full lg:w-48">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              📡 Connection
            </label>
            <select
              value={filters.browserConnectionId}
              onChange={(e) => setFilters({ ...filters, browserConnectionId: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} data-dark="true"
            >
              <option value="">Tất cả kết nối</option>
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>{conn.name}</option>
              ))}
            </select>
          </div>

          {/* Group Filter */}
          <div className="w-full lg:w-48">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              📁 Nhóm
            </label>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} data-dark="true"
            >
              <option value="">Tất cả nhóm</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {/* Browser Type Filter */}
          <div className="w-full lg:w-48">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              🌐 Browser Type
            </label>
            <select
              value={filters.browserType}
              onChange={(e) => setFilters({ ...filters, browserType: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} data-dark="true"
            >
              <option value="">Tất cả</option>
              <option value="chromium">Chromium (Chrome)</option>
              <option value="firefox">Firefox</option>
              <option value="gpm">GPM Browser</option>
            </select>
          </div>

          {/* Account Type Filter */}
          <div className="w-full lg:w-48">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              📧 Account Type
            </label>
            <select
              value={filters.accountType}
              onChange={(e) => setFilters({ ...filters, accountType: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} data-dark="true"
            >
              <option value="">Tất cả</option>
              {accountTypes
                .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
                .map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.icon && `${type.icon} `}
                    {type.label}
                  </option>
                ))}
            </select>
          </div>

          {/* Results Count */}
          <div className="text-sm text-gray-400 whitespace-nowrap flex items-center gap-1">
            <span className="font-semibold text-white">{profiles.length}</span>
            <span className="text-gray-400">/</span>
            <span>{allProfiles.length}</span>
            <span className="text-gray-400 ml-1">profiles</span>
          </div>

          {/* Clear Filters */}
          {(searchQuery || statusFilter || groupFilter || filters.browserType || filters.accountType || filters.browserConnectionId) && (
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('')
                setGroupFilter('')
                setFilters({
                  ...filters,
                  browserType: '',
                  accountType: '',
                  browserConnectionId: '',
                  currentPage: 1
                })
              }}
              className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors border border-white/10"
            >
              ✕ Clear Filters
            </button>
          )}

        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {selectedIds.size} profile(s) selected
            </span>
            <button
              onClick={handleBulkStart}
              disabled={Array.from(selectedIds).some((id) => processingIds.has(id))}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              ▶️ Start Selected
            </button>
            <button
              onClick={handleBulkStop}
              disabled={Array.from(selectedIds).some((id) => processingIds.has(id))}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              ⏹️ Stop Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <table className="min-w-full table-fixed" style={{ borderColor: 'var(--border-color)' }}>
          <thead style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-muted)' }}>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === profiles.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-white/10 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider w-32">
                Name
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider w-24">
                UID
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider min-w-[100px]">
                Group
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider min-w-[120px]">
                Proxy
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider w-32">
                Browser
              </th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-20">
                Auto Reset
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider w-24">
                Status
              </th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-20">
                Used
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider min-w-[140px]">
                Last Opened
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider sticky right-0 min-w-[200px]" style={{ backgroundColor: 'var(--bg-surface-2)' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody style={{ backgroundColor: 'var(--bg-surface)' }}>
            {paginatedProfiles.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-sm text-gray-400 bg-white/5">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">📭</span>
                    <span className="font-medium">Không tìm thấy profile nào</span>
                    <span className="text-xs text-gray-400">Thử thay đổi bộ lọc hoặc tạo profile mới</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedProfiles.map((profile) => (
                <tr
                  key={profile.id}
                  ref={highlightedProfileId === profile.id ? highlightedRowRef : null}
                  className={`hover:bg-white/5 transition-colors duration-700 ${highlightedProfileId === profile.id ? 'bg-yellow-100 ring-2 ring-yellow-400 ring-inset' : ''}`}
                >
                  <td className="px-3 py-2 whitespace-nowrap border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(profile.id)}
                      onChange={(e) => handleSelectOne(profile.id, e.target.checked)}
                      className="rounded border-white/10 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs font-medium border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <button
                      onClick={() => setDetailsProfileId(profile.id)}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-left truncate max-w-[120px]"
                      title={`Click to view details for ${profile.name}`}
                    >
                      {profile.name}
                    </button>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs font-mono font-semibold border-b" style={{ borderColor: 'var(--border-color)' }} title={profile.profileUid}>
                    <div className="flex flex-col">
                      <span>{profile.profileUid.substring(0, 8)}...</span>
                      {/* Badge hiển thị loại trình duyệt/provider */}
                      {profile.browserProvider === 'gpmlogin_global' && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-purple-900/30 text-purple-400 border border-purple-500/30 rounded font-bold uppercase tracking-tighter">
                          Global
                        </span>
                      )}
                      {profile.connection && profile.browserProvider !== 'gpmlogin_global' && (
                        <span className="text-[9px] text-gray-400 font-sans truncate max-w-[70px]">
                          {profile.connection.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs font-medium border-b" style={{ borderColor: 'var(--border-color)' }}>
                    {profile.groupId
                      ? groups.find((g) => g.id === profile.groupId)?.name || `Group ${profile.groupId}`
                      : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <ProxySelector
                      profileId={profile.id}
                      currentProxyId={profile.proxy?.id || null}
                      currentProxyLabel={profile.proxy?.label || null}
                      onSuccess={fetchProfiles}
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs border-b" style={{ borderColor: 'var(--border-color)' }}>
                    {profile.browserType ? (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full shadow-sm ${profile.browserType === 'gpm' ? 'bg-purple-600 text-white border border-purple-700' :
                          profile.browserType === 'chromium' ? 'bg-blue-600 text-white border border-blue-700' :
                            profile.browserType === 'firefox' ? 'bg-orange-600 text-white border border-orange-700' :
                              'bg-gray-600 text-white border border-gray-700'
                          }`}
                        title={`Browser Type: ${profile.browserType}, Provider: ${profile.browserProvider || 'gpmlogin'}`}
                      >
                        {profile.browserType === 'gpm' ? 'GPM' :
                          profile.browserType === 'chromium' ? (profile.browserProvider === 'chrome' ? 'Chrome' : 'GPM-Chr') :
                            profile.browserType === 'firefox' ? 'Firefox' :
                              profile.browserType}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[10px] font-semibold" title="Chưa có thông tin browser type. Hãy sync từ GPMLogin.">
                        <span className="opacity-70">—</span>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-center border-b" style={{ borderColor: 'var(--border-color)' }}>
                    {profile.autoResetIp ? (
                      <span className="text-green-600 font-black text-sm" title="Auto Reset IP enabled">✓</span>
                    ) : (
                      <span className="text-gray-400 font-semibold">-</span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap border-b" style={{ borderColor: 'var(--border-color)' }}>
                    {getStatusBadge(profile.status)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-semibold border-b" style={{ borderColor: 'var(--border-color)' }}>
                    {profile._count?.accounts || 0}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs font-medium border-b" style={{ borderColor: 'var(--border-color)' }}>
                    {profile.lastOpened
                      ? new Date(profile.lastOpened).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs font-medium sticky right-0 z-10 border-l border-b" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-1">
                      {profile.status === 'running' ? (
                        <button
                          onClick={() => handleStop(profile.id)}
                          disabled={processingIds.has(profile.id)}
                          className="px-1.5 py-0.5 text-[10px] font-medium text-red-700 hover:text-white hover:bg-red-600 border border-red-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          title="Dừng profile"
                        >
                          {processingIds.has(profile.id) ? '⏳' : '⏹️'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStart(profile.id)}
                          disabled={processingIds.has(profile.id)}
                          className="px-1.5 py-0.5 text-[10px] font-medium text-green-700 hover:text-white hover:bg-green-600 border border-green-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          title="Khởi động profile"
                        >
                          {processingIds.has(profile.id) ? '⏳' : '▶️'}
                        </button>
                      )}

                      {profile.status === 'running' && profile.remoteDebuggingPort && (
                        <button
                          onClick={() => setLiveViewProfile({ id: profile.id, port: profile.remoteDebuggingPort! })}
                          className="px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:text-white hover:bg-blue-600 border border-blue-300 rounded transition-colors whitespace-nowrap"
                          title="Xem trực tiếp (Live View)"
                        >
                          👁️ Live
                        </button>
                      )}

                      <button
                        onClick={() => setEditingProfileId(profile.id)}
                        className="px-1.5 py-0.5 text-[10px] font-medium text-gray-400 hover:text-white hover:bg-gray-600 border border-white/10 rounded transition-colors whitespace-nowrap"
                        title="Chỉnh sửa"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setExtensionsProfileId(profile.id)}
                        className="px-1.5 py-0.5 text-[10px] font-medium text-purple-700 hover:text-white hover:bg-purple-600 border border-purple-300 rounded transition-colors whitespace-nowrap"
                        title="Quản lý Extensions"
                      >
                        🔌
                      </button>
                      <button
                        onClick={async () => {
                          const profileInfo = profile.browserProvider === 'chrome' || profile.browserProvider === 'firefox'
                            ? `${profile.name} (${profile.browserProvider === 'chrome' ? 'Chrome' : 'Firefox'} profile - folder will be deleted)`
                            : profile.name

                          const confirmMessage = `Bạn có chắc chắn muốn xóa profile "${profileInfo}"?\n\n` +
                            `⚠️ Hành động này không thể hoàn tác.\n` +
                            (profile.browserProvider === 'chrome' || profile.browserProvider === 'firefox'
                              ? `📁 Thư mục profile trên đĩa cũng sẽ bị xóa.\n`
                              : '') +
                            `\nNhấn OK để xác nhận xóa.`

                          if (confirm(confirmMessage)) {
                            setProcessingIds((prev) => new Set(prev).add(profile.id))
                            try {
                              const res = await fetch(`/api/profiles/${profile.id}`, {
                                method: 'DELETE',
                              })
                              const data = await res.json()
                              if (data.success) {
                                showToast('Profile đã được xóa thành công', 'success')
                                fetchProfiles()
                              } else {
                                showToast(data.error || 'Xóa profile thất bại', 'error')
                              }
                            } catch (error) {
                              console.error('Error deleting profile:', error)
                              showToast('Lỗi khi xóa profile', 'error')
                            } finally {
                              setProcessingIds((prev) => {
                                const next = new Set(prev)
                                next.delete(profile.id)
                                return next
                              })
                            }
                          }
                        }}
                        disabled={processingIds.has(profile.id)}
                        className="px-1.5 py-0.5 text-[10px] font-medium text-red-700 hover:text-white hover:bg-red-600 border border-red-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        title="Xóa profile"
                      >
                        {processingIds.has(profile.id) ? '⏳' : '🗑️'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div >

      {/* Pagination */}
      {
        profiles.length > 0 && (
          <div className="rounded-xl border p-4 mt-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Page Info */}
              <div className="text-sm text-gray-400">
                Hiển thị{' '}
                <span className="font-semibold">
                  {startIndex + 1}-{Math.min(endIndex, profiles.length)}
                </span>{' '}
                trong tổng số <span className="font-semibold">{profiles.length}</span> profiles
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm text-gray-400 border border-white/10 rounded-md hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Trước
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 7) {
                      pageNum = i + 1
                    } else if (currentPage <= 4) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i
                    } else {
                      pageNum = currentPage - 3 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 border border-white/10 hover:bg-white/5'
                          }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm text-gray-400 border border-white/10 rounded-md hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Sau →
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Add/Edit Profile Modal */}
      <Modal
        isOpen={showAddModal || editingProfileId !== undefined}
        onClose={() => {
          setShowAddModal(false)
          setEditingProfileId(undefined)
        }}
        title={editingProfileId ? 'Chỉnh sửa Profile' : 'Thêm Profile Mới'}
      >
        <ProfileForm
          isOpen={showAddModal || editingProfileId !== undefined}
          onClose={() => {
            setShowAddModal(false)
            setEditingProfileId(undefined)
          }}
          onSuccess={() => {
            fetchProfiles()
            setShowAddModal(false)
            setEditingProfileId(undefined)
          }}
          profileId={editingProfileId}
        />
      </Modal>

      {/* Extensions Modal */}
      {
        extensionsProfileId && (
          <ProfileExtensionsModal
            isOpen={!!extensionsProfileId}
            onClose={() => setExtensionsProfileId(null)}
            profileId={extensionsProfileId}
            profileName={profiles.find((p) => p.id === extensionsProfileId)?.name || 'Profile'}
          />
        )
      }

      {/* Profile Details Modal */}
      <ProfileDetailModal
        isOpen={!!detailsProfileId}
        onClose={() => setDetailsProfileId(null)}
        profileId={detailsProfileId}
      />

      {/* Live View Modal */}
      {liveViewProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 pb-20 sm:pb-6">
          <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[100vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-gray-700 m-2 sm:m-0 mt-8 mb-[70px] sm:mb-0 relative">
            <div className="flex justify-between items-center p-3 border-b border-gray-800 bg-gray-950 shrink-0 sticky top-0 z-10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="text-xl shrink-0">👁️</span>
                <span className="truncate">Live View (Port: {liveViewProfile.port})</span>
              </h2>
              <button
                onClick={() => setLiveViewProfile(null)}
                className="text-gray-400 hover:text-white hover:bg-gray-800 p-2 sm:p-1.5 rounded transition-colors shrink-0 flex items-center justify-center min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 bg-gray-800/50 sm:bg-transparent"
                title="Đóng (Close)"
                type="button"
                style={{ touchAction: 'manipulation' }}
              >
                <svg className="w-6 h-6 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 min-h-[300px] bg-black relative isolate">
              <LiveViewer profileId={liveViewProfile.id} debuggerPort={liveViewProfile.port} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
