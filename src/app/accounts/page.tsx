'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Modal from '@/components/Modal'
import AccountForm from '@/components/AccountForm'
import AccountDetailModal from '@/components/AccountDetailModal'
import ProxySelector from '@/components/ProxySelector'
import ProfileDetailModal from '@/components/ProfileDetailModal'
import CreateAccountTypeModal from '@/components/CreateAccountTypeModal'
import { useToastContext } from '@/components/ToastProvider'
import { useFilterState } from '@/hooks/useFilterState'
import QuickAddAccountRow, {
  type QuickAddRowData,
  type QuickAddAccountType as QAAccountType,
  type QuickAddParentAccount,
  type QuickAddProfile,
} from '@/components/QuickAddAccountRow'
import SnapProfilesModal, { type SnapProfile } from '@/components/SnapProfilesModal'

interface Account {
  id: string
  label: string
  accountType: string
  identifier: string
  status: string
  lastCheck: string | null
  lastCare: string | null
  twoFactorSecret: string | null
  gpmloginProfileId: string | null
  proxyId: string | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
  profile: { id: string; name: string; proxy?: { id: string; label: string; rawProxy: string } | null } | null
  proxy: { id: string; label: string; rawProxy: string } | null
}

interface PluginInfo {
  accountType: string
  pluginName: string | null
  pluginLabel: string | null
  moduleEnabled: boolean
  hasCheck: boolean
  hasCare: boolean
  hasLogin: boolean
}

interface AccountType {
  id: string
  name: string
  label: string
  icon: string | null
  isActive: boolean
  sortOrder?: number
}

function makeRow(): QuickAddRowData {
  return {
    id: Math.random().toString(36).slice(2),
    accountType: 'gmail',
    identifier: '',
    password: '',
    twoFactorSecret: '',
    authViaAccountId: '',
    gpmloginProfileId: '',
    loginMethod: 'PASSWORD',
    notes: '',
  }
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [viewingAccountId, setViewingAccountId] = useState<string | null>(null)
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)
  const [launchingProfileId, setLaunchingProfileId] = useState<string | null>(null)
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false)

  // ── Quick Add state ──────────────────────────────────────────────────────
  const [isQuickAddMode, setIsQuickAddMode] = useState(false)
  const [quickAddRows, setQuickAddRows] = useState<QuickAddRowData[]>([])
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false)
  const [quickAddResults, setQuickAddResults] = useState<Record<string, { status: 'success' | 'error'; msg?: string }>>({})
  const [qaParentAccounts, setQaParentAccounts] = useState<QuickAddParentAccount[]>([])
  const [qaProfiles, setQaProfiles] = useState<QuickAddProfile[]>([])
  const [qaDataLoaded, setQaDataLoaded] = useState(false)

  // ── Snap Profiles state ───────────────────────────────────────────────────
  const [showSnapModal, setShowSnapModal] = useState(false)

  // Use filter state hook with localStorage persistence
  const {
    filters,
    updateFilter,
  } = useFilterState('accounts-filters', {
    searchQuery: '',
    statusFilter: '',
    typeFilter: '',
    profileFilter: '',
    currentPage: 1,
    perPage: 10,
  })

  const searchQuery = filters.searchQuery
  const statusFilter = filters.statusFilter
  const typeFilter = filters.typeFilter
  const profileFilter = filters.profileFilter
  const currentPage = filters.currentPage
  const perPage = filters.perPage

  // Update filter state when changing filters
  const setSearchQuery = (value: string) => updateFilter('searchQuery', value)
  const setStatusFilter = (value: string) => updateFilter('statusFilter', value)
  const setTypeFilter = (value: string) => updateFilter('typeFilter', value)
  const setProfileFilter = (value: string) => updateFilter('profileFilter', value)
  const setCurrentPage = (value: number) => updateFilter('currentPage', value)
  const setPerPage = (value: number) => updateFilter('perPage', value)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [pluginInfos, setPluginInfos] = useState<Record<string, PluginInfo>>({})
  const { showToast } = useToastContext()

  const handleSaveNote = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editingNoteText }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Ghi chú đã được lưu', 'success')
        fetchAccounts()
      } else {
        showToast(data.error || 'Lỗi khi lưu ghi chú', 'error')
      }
    } catch (error) {
      showToast('Lỗi khi kết nối', 'error')
    }
    setEditingNoteId(null)
  }

  const fetchAccounts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (typeFilter) params.append('type', typeFilter)
      if (searchQuery) params.append('search', searchQuery)

      const apiUrl = `/api/accounts?${params.toString()}`
      const res = await fetch(apiUrl)
      const data = await res.json()

      if (data.success) {
        setAllAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, searchQuery])

  useEffect(() => {
    // Fetch account types
    fetch('/api/account-types')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.accountTypes) {
          const activeTypes = data.accountTypes.filter((type: AccountType) => type.isActive)
          setAccountTypes(activeTypes)
        }
      })
      .catch(console.error)

    fetchAccounts()
    const interval = setInterval(fetchAccounts, 30000) // Auto-refresh every 30s
    return () => clearInterval(interval)
  }, [fetchAccounts])

  // ── Lazy-load Quick Add reference data once per session ──────────────────
  useEffect(() => {
    if (!isQuickAddMode || qaDataLoaded) return
    const load = async () => {
      try {
        const [accRes, profRes] = await Promise.all([
          fetch('/api/accounts?type=gmail&limit=1000').then((r) => r.json()),
          fetch('/api/profiles').then((r) => r.json()),
        ])
        if (accRes.success) setQaParentAccounts(accRes.accounts || [])
        if (profRes.success) setQaProfiles(profRes.profiles || [])
        setQaDataLoaded(true)
      } catch (e) {
        console.error('Quick Add data load error', e)
      }
    }
    load()
  }, [isQuickAddMode, qaDataLoaded])

  const openQuickAdd = () => {
    setQuickAddRows([makeRow()])
    setQuickAddResults({})
    setIsQuickAddMode(true)
  }

  const closeQuickAdd = () => {
    setIsQuickAddMode(false)
    setQuickAddRows([])
    setQuickAddResults({})
  }

  const addQuickRow = (afterId?: string) => {
    const newRow = makeRow()
    setQuickAddRows((prev) => {
      if (!afterId) return [...prev, newRow]
      const idx = prev.findIndex((r) => r.id === afterId)
      const next = [...prev]
      next.splice(idx + 1, 0, newRow)
      return next
    })
  }

  /**
   * Snap Profiles: nhận danh sách profile đã chọn từ SnapProfilesModal,
   * mở Quick Add Mode và tạo một row cho mỗi profile.
   */
  const handleSnapProfiles = (selectedProfiles: SnapProfile[], defaultType: string, defaultLoginMethod: string) => {
    if (selectedProfiles.length === 0) return

    const newRows: QuickAddRowData[] = selectedProfiles.map((p) => ({
      ...makeRow(),
      gpmloginProfileId: p.id,
      accountType: defaultType,
      loginMethod: defaultLoginMethod,
    }))

    if (!isQuickAddMode) {
      // Mở Quick Add Mode với các rows đã snap
      setQuickAddRows(newRows)
      setQuickAddResults({})
      setIsQuickAddMode(true)
    } else {
      // Đã trong Quick Add Mode → gắn thêm vào cuối
      // Loại bỏ row trống duy nhất nếu có
      setQuickAddRows((prev) => {
        const nonEmpty = prev.filter(
          (r) => r.identifier.trim() || r.gpmloginProfileId || r.password
        )
        return [...nonEmpty, ...newRows]
      })
    }

    showToast(`📸 Đã snap ${selectedProfiles.length} profile vào Quick Add!`, 'success')
  }

  const updateQuickRow = (id: string, data: QuickAddRowData) => {
    setQuickAddRows((prev) => prev.map((r) => (r.id === id ? data : r)))
  }

  const deleteQuickRow = (id: string) => {
    setQuickAddRows((prev) => {
      const next = prev.filter((r) => r.id !== id)
      // Always keep at least one empty row when in mode
      return next.length === 0 ? [makeRow()] : next
    })
  }

  const handleQuickAddSaveAll = async () => {
    const pending = quickAddRows.filter((r) => !quickAddResults[r.id] || quickAddResults[r.id].status !== 'success')

    if (pending.length === 0) {
      closeQuickAdd()
      return
    }

    setQuickAddSubmitting(true)
    const newResults: Record<string, { status: 'success' | 'error'; msg?: string }> = { ...quickAddResults }

    await Promise.all(
      pending.map(async (row) => {
        if (!row.identifier.trim()) {
          newResults[row.id] = { status: 'error', msg: 'Identifier is required' }
          return
        }
        try {
          const payload: any = {
            accountType: row.accountType,
            identifier: row.identifier.trim(),
            loginMethod: row.loginMethod || 'PASSWORD',
            autoCreateProfile: false,
          }
          if (row.password) payload.password = row.password
          if (row.twoFactorSecret) payload.twoFactorSecret = row.twoFactorSecret.trim()
          if (row.authViaAccountId) payload.authViaAccountId = row.authViaAccountId
          if (row.gpmloginProfileId) payload.gpmloginProfileId = row.gpmloginProfileId
          if (row.notes) payload.notes = row.notes

          const res = await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const data = await res.json()
          if (data.success) {
            newResults[row.id] = { status: 'success' }
          } else {
            newResults[row.id] = { status: 'error', msg: data.error || 'Failed' }
          }
        } catch (e: any) {
          newResults[row.id] = { status: 'error', msg: e.message || 'Network error' }
        }
      })
    )

    setQuickAddResults(newResults)
    setQuickAddSubmitting(false)

    const successCount = Object.values(newResults).filter((r) => r.status === 'success').length
    const errorCount = Object.values(newResults).filter((r) => r.status === 'error').length

    if (successCount > 0) {
      showToast(`✅ Saved ${successCount} account(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`, errorCount > 0 ? 'info' : 'success')
      fetchAccounts()
    }
    if (errorCount > 0 && successCount === 0) {
      showToast(`❌ All ${errorCount} row(s) failed — fix errors and retry`, 'error')
    }

    // Auto-remove successful rows after a short delay
    if (successCount > 0) {
      setTimeout(() => {
        setQuickAddRows((prev) => prev.filter((r) => newResults[r.id]?.status !== 'success'))
        setQuickAddResults((prev) => {
          const next = { ...prev }
          Object.keys(next).forEach((k) => { if (next[k].status === 'success') delete next[k] })
          return next
        })
        // If all rows saved successfully, exit mode
        if (errorCount === 0) closeQuickAdd()
      }, 1200)
    }
  }

  // Fetch plugin info for all account types (to show Check/Care buttons)
  useEffect(() => {
    const fetchPluginInfos = async () => {
      try {
        // Get all unique account types from accounts
        const accountTypes = Array.from(new Set(allAccounts.map((acc) => acc.accountType)))

        if (accountTypes.length === 0) return

        const res = await fetch(
          `/api/plugins/account-types?types=${accountTypes.join(',')}`
        )
        const data = await res.json()
        if (data.success) {
          setPluginInfos(data.plugins || {})
        }
      } catch (error) {
        console.error('Error fetching plugin infos:', error)
      }
    }

    fetchPluginInfos()
  }, [allAccounts])

  useEffect(() => {
    // Filter accounts based on profile only
    // Note: searchQuery, statusFilter, and typeFilter are handled by API (server-side)
    // Only profileFilter needs client-side filtering since API doesn't support it
    let filtered = [...allAccounts]

    if (profileFilter) {
      filtered = filtered.filter((a) => a.profile?.name === profileFilter)
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aValue: any
        let bValue: any

        switch (sortColumn) {
          case 'label':
            aValue = a.label || ''
            bValue = b.label || ''
            break
          case 'type':
            aValue = a.accountType || ''
            bValue = b.accountType || ''
            break
          case 'identifier':
            aValue = a.identifier || ''
            bValue = b.identifier || ''
            break
          case 'profile':
            aValue = a.profile?.name || ''
            bValue = b.profile?.name || ''
            break
          case 'proxy':
            aValue = a.profile?.proxy?.label || a.proxy?.label || ''
            bValue = b.profile?.proxy?.label || b.proxy?.label || ''
            break
          case 'status':
            aValue = a.status || ''
            bValue = b.status || ''
            break
          case 'lastCheck':
            aValue = a.lastCheck ? new Date(a.lastCheck).getTime() : 0
            bValue = b.lastCheck ? new Date(b.lastCheck).getTime() : 0
            break
          case 'createdAt':
            aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0
            bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0
            break
          case 'notes':
            aValue = a.notes || ''
            bValue = b.notes || ''
            break
          default:
            return 0
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue)
          return sortDirection === 'asc' ? comparison : -comparison
        } else {
          const comparison = aValue - bValue
          return sortDirection === 'asc' ? comparison : -comparison
        }
      })
    } else {
      // Default sort by createdAt (newest first)
      filtered.sort((a, b) => {
        const dateA = a.createdAt || a.updatedAt || ''
        const dateB = b.createdAt || b.updatedAt || ''
        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
    }

    setAccounts(filtered)
  }, [allAccounts, profileFilter, sortColumn, sortDirection])

  // Reset to page 1 when profileFilter changes (separate effect to avoid resetting on pagination)
  // Note: searchQuery, statusFilter, typeFilter trigger fetchAccounts() which resets page automatically
  const prevFiltersRef = useRef({ profileFilter })
  useEffect(() => {
    const filtersChanged = prevFiltersRef.current.profileFilter !== profileFilter

    if (filtersChanged) {
      setCurrentPage(1)
      prevFiltersRef.current = { profileFilter }
    }
  }, [profileFilter, setCurrentPage])

  // Pagination logic - computed values
  const totalPages = Math.ceil(accounts.length / perPage)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const paginatedAccounts = accounts.slice(startIndex, endIndex)

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])



  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(`/api/accounts/export?format=${format}`)
      if (format === 'csv') {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `accounts_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        showToast('Accounts exported to CSV', 'success')
      } else {
        const data = await res.json()
        if (data.success) {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `accounts_${new Date().toISOString().split('T')[0]}.json`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
          showToast('Accounts exported to JSON', 'success')
        }
      }
    } catch (error) {
      showToast('Failed to export accounts', 'error')
    }
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      let accounts: any[] = []

      if (file.name.endsWith('.csv')) {
        // Parse CSV
        const lines = text.split('\n')
        const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
        accounts = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
          const account: any = {}
          headers.forEach((header, index) => {
            account[header.toLowerCase().replace(/\s+/g, '')] = values[index] || ''
          })
          return account
        })
      } else if (file.name.endsWith('.json')) {
        // Parse JSON
        const data = JSON.parse(text)
        accounts = Array.isArray(data.accounts) ? data.accounts : Array.isArray(data) ? data : []
      } else {
        showToast('Unsupported file format', 'error')
        return
      }

      // Map to API format with all fields
      const mappedAccounts = accounts.map((acc) => ({
        label: acc.label || acc.Label || acc.label || '',
        accountType: acc.accounttype || acc.accountType || acc['Account Type'] || acc.accounttype || 'gmail',
        identifier: acc.identifier || acc.Identifier || acc.identifier || '',
        password: acc.password || acc.Password || acc.passwordencrypted || acc.password || '',
        passwordEncrypted: acc.passwordencrypted || acc.passwordEncrypted || acc.password || acc.Password || '',
        twoFactorSecret: acc.twofactorsecret || acc['2FA Secret'] || acc.twoFactorSecret || acc['2fasecret'] || '',
        profileName: acc.profilename || acc.profileName || acc.profile || acc.Profile || acc['Profile Name'] || '',
        profileId: acc.profileid || acc.profileId || acc['Profile ID'] || '',
        proxyLabel: acc.proxylabel || acc.proxyLabel || acc.proxy || acc.Proxy || acc['Proxy Label'] || '',
        proxyId: acc.proxyid || acc.proxyId || acc['Proxy ID'] || '',
        autoChangeProxy: acc.autochangeproxy === 'true' || acc.autoChangeProxy === true || acc['Auto Change Proxy'] === 'true' || acc['Auto Change Proxy'] === true || false,
        status: acc.status || acc.Status || 'active',
        notes: acc.notes || acc.Notes || '',
        autoCreateProfile: acc.autocreateprofile === 'true' || acc.autoCreateProfile === true || acc['Auto Create Profile'] === 'true' || false,
        autoCreateProfileGroupId: acc.autocreateprofilegroupid || acc.autoCreateProfileGroupId || acc['Auto Create Profile Group Id'] || null,
      }))

      const res = await fetch('/api/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: mappedAccounts }),
      })

      const result = await res.json()
      if (result.success) {
        showToast(`Imported ${result.imported}/${result.total} accounts`, 'success')
        if (result.errors && result.errors.length > 0) {
          console.warn('Import errors:', result.errors)
        }
        fetchAccounts()
      } else {
        showToast(result.error || 'Import failed', 'error')
      }
    } catch (error) {
      showToast('Failed to import accounts', 'error')
      console.error('Import error:', error)
    }
  }



  const handleGet2FA = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/2fa`)
      const data = await res.json()
      if (data.success && data.code) {
        await navigator.clipboard.writeText(data.code)
        showToast(`2FA code copied: ${data.code}`, 'success')
      } else {
        showToast(data.error || 'Failed to generate 2FA code', 'error')
      }
    } catch (error) {
      showToast('Failed to get 2FA code', 'error')
    }
  }

  const handleBulkCheck = async () => {
    if (selectedIds.size === 0) {
      showToast('Please select at least one account', 'error')
      return
    }

    try {
      const res = await fetch('/api/accounts/check-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Bulk check started for ${selectedIds.size} accounts`, 'success')
        setSelectedIds(new Set())
        fetchAccounts()
      } else {
        showToast(data.error || 'Bulk check failed', 'error')
      }
    } catch (error) {
      showToast('Failed to start bulk check', 'error')
      console.error('Bulk check error:', error)
    }
  }

  const handleBulkCare = async () => {
    if (selectedIds.size === 0) {
      showToast('Please select at least one account', 'error')
      return
    }

    try {
      const res = await fetch('/api/accounts/care-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Bulk care started for ${selectedIds.size} accounts`, 'success')
        setSelectedIds(new Set())
        fetchAccounts()
      } else {
        showToast(data.error || 'Bulk care failed', 'error')
      }
    } catch (error) {
      showToast('Failed to start bulk care', 'error')
      console.error('Bulk care error:', error)
    }
  }

  const handleSyncLabels = async () => {
    if (!confirm('Bạn có chắc muốn đồng bộ lại tất cả label? Tất cả label sẽ được đổi thành format 4 số tăng dần (0001, 0002, ...)')) {
      return
    }

    try {
      const res = await fetch('/api/accounts/sync-labels', {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Đã đồng bộ ${data.updated} account labels`, 'success')
        fetchAccounts()
      } else {
        showToast(data.error || 'Sync labels failed', 'error')
      }
    } catch (error) {
      showToast('Failed to sync labels', 'error')
      console.error('Sync labels error:', error)
    }
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <span className="text-gray-400 text-xs">↕</span>
    }
    return sortDirection === 'asc' ? <span className="text-blue-600">↑</span> : <span className="text-blue-600">↓</span>
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      logged_out: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      banned: 'bg-red-200 text-red-900',
    }
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'
          }`}
      >
        {status}
      </span>
    )
  }

  // Get unique values for filters
  // For profiles, use unique from accounts
  const uniqueProfiles = Array.from(
    new Set(allAccounts.map((a) => a.profile?.name).filter((n): n is string => !!n))
  )

  // For account types, use all active types from database (not just from accounts)
  // This allows filtering by types that exist but may not have accounts yet
  const uniqueTypes = accountTypes.length > 0
    ? accountTypes.map((t) => t.name)
    : Array.from(new Set(allAccounts.map((a) => a.accountType)))

  // Helper to get account type label with icon
  const getAccountTypeLabel = (typeName: string) => {
    const accountType = accountTypes.find((t) => t.name === typeName)
    return accountType ? `${accountType.icon ? accountType.icon + ' ' : ''}${accountType.label}` : typeName
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="w-full px-4 sm:px-0">
      {/* Title with Action Buttons */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchAccounts}
            className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 active:bg-gray-300 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
            title="Refresh"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.csv,.json'
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) handleImport(file)
              }
              input.click()
            }}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
            title="Import Accounts"
          >
            <span>📥</span>
            <span>Import</span>
          </button>
          <button
            onClick={() => {
              // Show dropdown for export format
              const format = confirm('Export as CSV? (Cancel for JSON)') ? 'csv' : 'json'
              handleExport(format)
            }}
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 active:bg-green-800 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
            title="Export Accounts"
          >
            <span>📤</span>
            <span>Export</span>
          </button>
          <button
            onClick={() => setShowCreateTypeModal(true)}
            className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-md hover:bg-teal-700 active:bg-teal-800 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
            title="Tạo loại account mới"
          >
            <span>🗂️</span>
            <span>+ Account Type</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 active:bg-indigo-800 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
          >
            <span>+</span>
            <span>Add Account</span>
          </button>
          <button
            onClick={openQuickAdd}
            disabled={isQuickAddMode}
            className="px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-md hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
            title="Thêm nhiều accounts nhanh như Excel"
          >
            <span>⚡</span>
            <span>Quick Add</span>
          </button>
          <button
            onClick={() => setShowSnapModal(true)}
            className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700 active:bg-violet-800 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
            title="Snap tài khoản từ các profile đang mở"
          >
            <span>📸</span>
            <span>Snap Profiles</span>
          </button>
          <button
            onClick={handleSyncLabels}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 active:bg-purple-800 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
            title="Đồng bộ lại tất cả label thành format 4 số"
          >
            <span>🔄</span>
            <span>Sync Labels</span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        {/* Filters Row */}
        <div className="flex flex-wrap gap-3 items-end mb-3">
          {/* Search Input */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              🔍 Tìm kiếm
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo label, identifier..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              📊 Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="">Tất cả</option>
              <option value="active">Active</option>
              <option value="logged_out">Logged Out</option>
              <option value="error">Error</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              📋 Loại
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="">Tất cả</option>
              {uniqueTypes
                .sort((a, b) => {
                  // Sort by AccountType sortOrder if available
                  const typeA = accountTypes.find((t) => t.name === a)
                  const typeB = accountTypes.find((t) => t.name === b)
                  if (typeA && typeB && (typeA as any).sortOrder !== (typeB as any).sortOrder) {
                    return ((typeA as any).sortOrder ?? 0) - ((typeB as any).sortOrder ?? 0)
                  }
                  return (typeA?.label || '').localeCompare(typeB?.label || '')
                })
                .map((type) => (
                  <option key={type} value={type}>
                    {getAccountTypeLabel(type)}
                  </option>
                ))}
            </select>
          </div>

          {/* Profile Filter */}
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              👤 Profile
            </label>
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="">Tất cả</option>
              {uniqueProfiles.map((profile) => (
                <option key={profile} value={profile}>
                  {profile}
                </option>
              ))}
            </select>
          </div>

          {/* Results Count */}
          <div className="text-sm text-gray-700 whitespace-nowrap self-end mb-1 px-2 py-1 bg-gray-50 rounded-md">
            <span className="font-semibold text-blue-600">{accounts.length}</span>
            <span className="text-gray-500"> / {allAccounts.length}</span>
          </div>

          {/* Clear Filters */}
          {(searchQuery || statusFilter || typeFilter || profileFilter) && (
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('')
                setTypeFilter('')
                setProfileFilter('')
                setCurrentPage(1)
              }}
              className="px-3 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors self-end mb-1 border border-gray-300"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Action Buttons Row - Grouped by Plugin */}
        {selectedIds.size > 0 && (() => {
          // Get selected accounts and their types
          const selectedAccounts = allAccounts.filter((acc) => selectedIds.has(acc.id))
          const accountTypes = Array.from(new Set(selectedAccounts.map((acc) => acc.accountType)))

          // Group selected accounts by plugin
          const accountsByPlugin: Record<string, { accounts: Account[]; pluginInfo: PluginInfo; accountTypes: string[] }> = {}

          accountTypes.forEach((type) => {
            const pluginInfo = pluginInfos[type]
            if (!pluginInfo) return

            const pluginKey = pluginInfo.pluginLabel || pluginInfo.pluginName || type
            if (!accountsByPlugin[pluginKey]) {
              accountsByPlugin[pluginKey] = {
                accounts: [],
                pluginInfo,
                accountTypes: [],
              }
            }
            const typeAccounts = selectedAccounts.filter((acc) => acc.accountType === type)
            accountsByPlugin[pluginKey].accounts.push(...typeAccounts)
            if (!accountsByPlugin[pluginKey].accountTypes.includes(type)) {
              accountsByPlugin[pluginKey].accountTypes.push(type)
            }
          })

          const pluginKeys = Object.keys(accountsByPlugin)
          const accountsWithoutPlugin = selectedAccounts.filter((acc) => {
            const pluginInfo = pluginInfos[acc.accountType]
            return !pluginInfo || !pluginInfo.moduleEnabled
          })

          if (pluginKeys.length === 0 && accountsWithoutPlugin.length === 0) {
            // Loading plugin info
            return (
              <div className="pt-3 border-t border-gray-200 mt-3">
                <div className="text-sm text-gray-500">Loading plugin information...</div>
              </div>
            )
          }

          return (
            <div className="space-y-3 pt-3 border-t border-gray-200 mt-3">
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-blue-600">{selectedIds.size}</span> account(s) selected
              </div>

              {/* Group actions by plugin */}
              {pluginKeys.map((pluginKey) => {
                const { accounts: pluginAccounts, pluginInfo, accountTypes: pluginAccountTypes } = accountsByPlugin[pluginKey]
                const accountIds = pluginAccounts.map((acc) => acc.id)

                return (
                  <div key={pluginKey} className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold text-blue-900">
                          {pluginInfo.pluginLabel || pluginInfo.pluginName || 'Unknown Plugin'}
                        </div>
                        <div className="text-xs text-blue-700">
                          {pluginAccounts.length} account(s) • Types: {pluginAccountTypes.join(', ')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pluginInfo.hasCheck && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/accounts/check-bulk', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ accountIds }),
                              })
                              const data = await res.json()
                              if (data.success) {
                                showToast(`Bulk check started for ${pluginAccounts.length} account(s) (${pluginInfo.pluginLabel})`, 'success')
                                setSelectedIds(new Set())
                                fetchAccounts()
                              } else {
                                showToast(data.error || 'Bulk check failed', 'error')
                              }
                            } catch (error) {
                              showToast('Failed to start bulk check', 'error')
                              console.error('Bulk check error:', error)
                            }
                          }}
                          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors whitespace-nowrap shadow-sm hover:shadow-md"
                        >
                          ✓ Check ({pluginAccounts.length})
                        </button>
                      )}
                      {pluginInfo.hasCare && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/accounts/care-bulk', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ accountIds }),
                              })
                              const data = await res.json()
                              if (data.success) {
                                const actionLabel = pluginInfo.pluginName === 'coingecko_candy' ? 'Claim Candy' : 'Care'
                                showToast(`Bulk ${actionLabel} started for ${pluginAccounts.length} account(s) (${pluginInfo.pluginLabel})`, 'success')
                                setSelectedIds(new Set())
                                fetchAccounts()
                              } else {
                                showToast(data.error || 'Bulk care failed', 'error')
                              }
                            } catch (error) {
                              showToast('Failed to start bulk care', 'error')
                              console.error('Bulk care error:', error)
                            }
                          }}
                          className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 active:bg-green-800 transition-colors whitespace-nowrap shadow-sm hover:shadow-md"
                        >
                          {pluginInfo.pluginName === 'coingecko_candy' ? '🍬' : '♥'} {pluginInfo.pluginName === 'coingecko_candy' ? 'Claim Candy' : 'Care'} ({pluginAccounts.length})
                        </button>
                      )}
                      {!pluginInfo.moduleEnabled && (
                        <span className="text-xs text-red-600 font-medium">
                          ⚠️ Plugin disabled
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Show warning if some accounts have no plugin */}
              {accountsWithoutPlugin.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="text-sm text-yellow-800">
                    ⚠️ {accountsWithoutPlugin.length} account(s) have no enabled plugin or plugin is disabled
                  </div>
                  <div className="text-xs text-yellow-700 mt-1">
                    Types: {Array.from(new Set(accountsWithoutPlugin.map((acc) => acc.accountType))).join(', ')}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* ── Quick Add toolbar ─────────────────────────────────────────────── */}
      {isQuickAddMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-semibold text-amber-800">⚡ Quick Add Mode</span>
            <span className="text-xs text-amber-600">
              {quickAddRows.length} row(s) · Tab/Enter on last field = new row · Esc = remove row
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSnapModal(true)}
              disabled={quickAddSubmitting}
              className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-1"
              title="Snap thêm profile từ danh sách đang mở"
            >
              📸 Snap Profiles
            </button>
            <button
              type="button"
              onClick={() => addQuickRow()}
              disabled={quickAddSubmitting}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 text-amber-700 rounded-md hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              + Add Row
            </button>
            <button
              type="button"
              onClick={handleQuickAddSaveAll}
              disabled={quickAddSubmitting}
              className="px-4 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {quickAddSubmitting ? (
                <><span className="animate-spin">⏳</span> Saving...</>
              ) : (
                <>💾 Save All ({quickAddRows.filter((r) => !quickAddResults[r.id] || quickAddResults[r.id].status !== 'success').length})</>
              )}
            </button>
            <button
              type="button"
              onClick={closeQuickAdd}
              disabled={quickAddSubmitting}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-x-auto sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                {isQuickAddMode ? (
                  <span className="text-amber-500">#</span>
                ) : (
                  <input
                    type="checkbox"
                    checked={paginatedAccounts.length > 0 && paginatedAccounts.every((a) => selectedIds.has(a.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newSet = new Set(selectedIds)
                        paginatedAccounts.forEach((a) => newSet.add(a.id))
                        setSelectedIds(newSet)
                      } else {
                        const newSet = new Set(selectedIds)
                        paginatedAccounts.forEach((a) => newSet.delete(a.id))
                        setSelectedIds(newSet)
                      }
                    }}
                  />
                )}
              </th>
              {isQuickAddMode ? (
                <>
                  <th className="px-1 py-2 text-left text-xs font-medium text-amber-600 uppercase tracking-wider w-28">Type</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-amber-600 uppercase tracking-wider w-28">Login Mode</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-amber-600 uppercase tracking-wider">Identifier *</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-amber-600 uppercase tracking-wider w-32">Password</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-amber-600 uppercase tracking-wider w-28">2FA</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-amber-600 uppercase tracking-wider w-44">Login via Account</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-amber-600 uppercase tracking-wider w-44">Browser Profile</th>
                  <th className="px-1 py-2 text-left text-xs font-medium text-amber-600 uppercase tracking-wider">Notes</th>
                  <th className="px-1 py-2 w-16"></th>
                </>
              ) : (
                <>
                  <th
                    className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('label')}
                  >
                    <div className="flex items-center gap-1">Label {getSortIcon('label')}</div>
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center gap-1">Type {getSortIcon('type')}</div>
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('identifier')}
                  >
                    <div className="flex items-center gap-1">Identifier {getSortIcon('identifier')}</div>
                  </th>
                  <th
                    className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('profile')}
                  >
                    <div className="flex items-center gap-1">Profile {getSortIcon('profile')}</div>
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('proxy')}
                  >
                    <div className="flex items-center gap-1">Proxy {getSortIcon('proxy')}</div>
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">Status {getSortIcon('status')}</div>
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('lastCheck')}
                  >
                    <div className="flex items-center gap-1">Last Check {getSortIcon('lastCheck')}</div>
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">Created {getSortIcon('createdAt')}</div>
                  </th>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('notes')}
                  >
                    <div className="flex items-center gap-1">Notes {getSortIcon('notes')}</div>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* ── Quick Add inline rows ─────────────────────────────────────── */}
            {isQuickAddMode &&
              quickAddRows.map((row, idx) => (
                <QuickAddAccountRow
                  key={row.id}
                  rowIndex={idx}
                  data={row}
                  onChange={(d) => updateQuickRow(row.id, d)}
                  onDelete={() => deleteQuickRow(row.id)}
                  onAddNext={() => addQuickRow(row.id)}
                  accountTypes={(accountTypes as any[]).map((t) => ({ id: t.id, name: t.name, label: t.label, icon: t.icon })) as QAAccountType[]}
                  parentAccounts={qaParentAccounts}
                  profiles={qaProfiles}
                  isSubmitting={quickAddSubmitting}
                  status={quickAddResults[row.id]?.status}
                  errorMsg={quickAddResults[row.id]?.msg}
                />
              ))}
            {/* ── Separator between quick add rows and existing accounts ─── */}
            {isQuickAddMode && quickAddRows.length > 0 && paginatedAccounts.length > 0 && (
              <tr>
                <td colSpan={9} className="py-1 bg-gray-100">
                  <div className="flex items-center gap-2 px-3">
                    <div className="flex-1 h-px bg-gray-300" />
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Existing accounts</span>
                    <div className="flex-1 h-px bg-gray-300" />
                  </div>
                </td>
              </tr>
            )}
            {paginatedAccounts.length === 0 && !isQuickAddMode ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-500">
                  No accounts found
                </td>
              </tr>
            ) : paginatedAccounts.length === 0 && isQuickAddMode ? null : (
              paginatedAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap border-b border-gray-100">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(account.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedIds)
                        if (e.target.checked) {
                          newSet.add(account.id)
                        } else {
                          newSet.delete(account.id)
                        }
                        setSelectedIds(newSet)
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900 border-b border-gray-100">
                    <span
                      title={account.label}
                      className="block truncate max-w-[52px]"
                    >
                      {account.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 border-b border-gray-100">
                    <span className="inline-flex items-center gap-1">
                      {getAccountTypeLabel(account.accountType)}
                    </span>
                  </td>
                  <td
                    className="px-3 py-2 whitespace-nowrap text-xs text-blue-600 cursor-pointer hover:text-blue-800 hover:underline transition-colors border-b border-gray-100"
                    onClick={() => setViewingAccountId(account.id)}
                    title="Click to view account details"
                  >
                    {account.identifier}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 border-b border-gray-100">
                    <span
                      title={account.profile?.name || '-'}
                      className="block truncate max-w-[120px]"
                    >
                      {account.profile?.name || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap border-b border-gray-100">
                    <ProxySelector
                      accountId={account.id}
                      currentProxyId={account.proxy?.id || null}
                      currentProxyLabel={account.proxy?.label || null}
                      inheritedProxyId={!account.proxy ? (account.profile?.proxy?.id || null) : null}
                      inheritedProxyLabel={!account.proxy ? (account.profile?.proxy?.label || null) : null}
                      onSuccess={fetchAccounts}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap border-b border-gray-100">
                    {getStatusBadge(account.status)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 border-b border-gray-100">
                    {account.lastCheck
                      ? new Date(account.lastCheck).toLocaleString('vi-VN')
                      : '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-400 border-b border-gray-100">
                    {account.createdAt
                      ? new Date(account.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 border-b border-gray-100 group">
                    {editingNoteId === account.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingNoteText}
                        onChange={(e) => setEditingNoteText(e.target.value)}
                        onBlur={() => handleSaveNote(account.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveNote(account.id)
                          if (e.key === 'Escape') setEditingNoteId(null)
                        }}
                        className="w-full rounded border-blue-500 px-1 py-0.5 text-xs text-gray-900 bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[120px] max-w-[200px]"
                      />
                    ) : (
                      <div 
                        className="truncate max-w-[150px] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1" 
                        onClick={() => {
                          setEditingNoteId(account.id)
                          setEditingNoteText(account.notes || '')
                        }}
                        title={account.notes || 'Thêm ghi chú...'}
                      >
                        {account.notes ? account.notes : <span className="text-gray-300 italic group-hover:text-gray-400">Thêm...</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs font-medium border-b border-gray-100">
                    <div className="flex items-center gap-0.5 flex-nowrap">
                      {/* Check button - only show if plugin supports check */}
                      {pluginInfos[account.accountType]?.hasCheck && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/accounts/${account.id}/check`, {
                                method: 'POST',
                              })
                              const data = await res.json()
                              if (data.success) {
                                showToast('Check started', 'success')
                                fetchAccounts()
                              } else {
                                showToast(data.error || 'Check failed', 'error')
                              }
                            } catch (error) {
                              console.error('Error checking account:', error)
                              showToast('Error checking account', 'error')
                            }
                          }}
                          className="px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-300 rounded transition-colors whitespace-nowrap"
                          title="Check account"
                        >
                          ✓
                        </button>
                      )}
                      {/* Care button - only show if plugin supports care */}
                      {pluginInfos[account.accountType]?.hasCare && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/accounts/${account.id}/care`, {
                                method: 'POST',
                              })
                              const data = await res.json()
                              if (data.success) {
                                const actionLabel = pluginInfos[account.accountType]?.pluginName === 'coingecko_candy' ? 'Claim Candy' : 'Care'
                                showToast(`${actionLabel} started`, 'success')
                                fetchAccounts()
                              } else {
                                showToast(data.error || 'Care failed', 'error')
                              }
                            } catch (error) {
                              console.error('Error caring account:', error)
                              showToast('Error caring account', 'error')
                            }
                          }}
                          className="px-1.5 py-0.5 text-[10px] font-medium text-green-600 hover:text-white hover:bg-green-600 border border-green-300 rounded transition-colors whitespace-nowrap"
                          title={pluginInfos[account.accountType]?.pluginName === 'coingecko_candy' ? 'Claim Candy' : 'Care account'}
                        >
                          {pluginInfos[account.accountType]?.pluginName === 'coingecko_candy' ? '🍬' : '♥'}
                        </button>
                      )}
                      {/* 2FA button */}
                      {account.twoFactorSecret && (
                        <button
                          onClick={() => handleGet2FA(account.id)}
                          className="px-1.5 py-0.5 text-[10px] font-medium text-purple-600 hover:text-white hover:bg-purple-600 border border-purple-300 rounded transition-colors whitespace-nowrap"
                          title="Get 2FA Code"
                        >
                          🔐
                        </button>
                      )}
                      {/* Launch Profile button */}
                      {(account.gpmloginProfileId || account.profile?.id) && (
                        <button
                          onClick={async () => {
                            const profileId = account.gpmloginProfileId || account.profile?.id
                            if (!profileId || launchingProfileId === profileId) return
                            setLaunchingProfileId(profileId)
                            try {
                              const controller = new AbortController()
                              const timeout = setTimeout(() => controller.abort(), 60000)
                              const res = await fetch(`/api/profiles/${profileId}/start?accountId=${account.id}`, {
                                method: 'POST',
                                signal: controller.signal,
                              })
                              clearTimeout(timeout)
                              const data = await res.json()
                              if (data.success) {
                                showToast('🚀 Profile launched!', 'success')
                              } else {
                                showToast(data.error || 'Launch failed', 'error')
                              }
                            } catch (e: any) {
                              if (e?.name === 'AbortError') {
                                showToast('Launch timeout — GPMLogin đang khởi động, vui lòng kiểm tra lại', 'info')
                              } else {
                                showToast('Không kết nối được GPMLogin (port 19995). Hãy mở GPMLogin trước.', 'error')
                              }
                            } finally {
                              setLaunchingProfileId(null)
                            }
                          }}
                          disabled={launchingProfileId === (account.gpmloginProfileId || account.profile?.id)}
                          className="px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 hover:text-white hover:bg-emerald-600 border border-emerald-300 rounded transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Khởi động trình duyệt profile"
                        >
                          {launchingProfileId === (account.gpmloginProfileId || account.profile?.id) ? '⏳' : '🚀'}
                        </button>
                      )}
                      {/* Open Profile button */}
                      {(account.gpmloginProfileId || account.profile?.id) && (
                        <button
                          onClick={() => {
                            const profileId = account.gpmloginProfileId || account.profile?.id || null
                            setViewingProfileId(profileId)
                          }}
                          className="px-1.5 py-0.5 text-[10px] font-medium text-teal-600 hover:text-white hover:bg-teal-600 border border-teal-300 rounded transition-colors whitespace-nowrap"
                          title="Mở Profile"
                        >
                          👤
                        </button>
                      )}
                      {/* Edit button */}
                      <button
                        onClick={() => setEditingAccountId(account.id)}
                        className="px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:text-white hover:bg-gray-600 border border-gray-300 rounded transition-colors whitespace-nowrap"
                        title="Chỉnh sửa"
                      >
                        ✏️
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete account "${account.label}"?`)) {
                            try {
                              const res = await fetch(`/api/accounts/${account.id}`, {
                                method: 'DELETE',
                              })
                              const data = await res.json()
                              if (data.success) {
                                showToast('Account deleted successfully', 'success')
                                fetchAccounts()
                              } else {
                                showToast(data.error || 'Delete failed', 'error')
                              }
                            } catch (error) {
                              console.error('Error deleting account:', error)
                              showToast('Error deleting account', 'error')
                            }
                          }
                        }}
                        className="px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-300 rounded transition-colors whitespace-nowrap"
                        title="Xóa tài khoản"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="bg-white shadow rounded-lg p-4 mt-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Per page:</label>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Account Modal */}
      <Modal
        isOpen={showAddModal || editingAccountId !== null}
        onClose={() => {
          setShowAddModal(false)
          setEditingAccountId(null)
        }}
        title={editingAccountId ? 'Edit Account' : 'Add Account'}
        size="lg"
      >
        <AccountForm
          isOpen={showAddModal || editingAccountId !== null}
          onClose={() => {
            setShowAddModal(false)
            setEditingAccountId(null)
          }}
          onSuccess={() => {
            fetchAccounts()
          }}
          accountId={editingAccountId || undefined}
        />
      </Modal>

      {/* Account Detail Modal */}
      <AccountDetailModal
        isOpen={viewingAccountId !== null}
        onClose={() => setViewingAccountId(null)}
        accountId={viewingAccountId}
      />

      {/* Profile Detail Modal (opened from 👤 button) */}
      <ProfileDetailModal
        isOpen={viewingProfileId !== null}
        onClose={() => setViewingProfileId(null)}
        profileId={viewingProfileId}
      />

      {/* Create Account Type Modal */}
      <CreateAccountTypeModal
        isOpen={showCreateTypeModal}
        onClose={() => setShowCreateTypeModal(false)}
        onSuccess={() => {
          // Reload account types for the filter dropdown
          fetch('/api/account-types')
            .then((r) => r.json())
            .then((data) => {
              if (data.success && data.accountTypes) {
                setAccountTypes(data.accountTypes.filter((t: typeof accountTypes[0]) => t.isActive))
              }
            })
            .catch(console.error)
        }}
      />

      {/* Snap Profiles Modal */}
      <SnapProfilesModal
        isOpen={showSnapModal}
        onClose={() => setShowSnapModal(false)}
        onSnap={handleSnapProfiles}
        accountTypes={accountTypes}
      />
    </div>
  )
}

