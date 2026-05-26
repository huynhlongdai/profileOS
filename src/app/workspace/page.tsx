'use client'

import { useEffect, useState, useCallback } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import {
  Globe, Users, Shield, RefreshCw, Play, Square, Trash2,
  ChevronDown, Search, CheckSquare, Zap, Link2, ArrowRight,
} from 'lucide-react'

interface Profile {
  id: string
  name: string
  profileUid: string
  status: string
  browserType: string | null
  browserProvider: string | null
  proxy: { id: string; label: string; rawProxy: string } | null
  group: { id: number; name: string } | null
  _count?: { accounts: number }
}

interface Account {
  id: string
  identifier: string
  typeName: string
  profileId: string | null
  profile?: { name: string } | null
  status: string
}

interface Proxy {
  id: string
  label: string
  rawProxy: string
  status: string
  _count: { accounts: number; profiles: number }
}

type Tab = 'profiles' | 'accounts' | 'proxies'

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<Tab>('profiles')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const { showToast } = useToastContext()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, aRes, xRes] = await Promise.all([
        fetch('/api/profiles'),
        fetch('/api/accounts'),
        fetch('/api/proxies'),
      ])
      const [pData, aData, xData] = await Promise.all([pRes.json(), aRes.json(), xRes.json()])
      if (pData.success) setProfiles(pData.data || [])
      if (aData.success) setAccounts(aData.data || [])
      if (xData.success) setProxies(xData.data || [])
    } catch {
      showToast('Failed to load data', 'error')
    }
    setLoading(false)
  }, [showToast])

  useEffect(() => { fetchAll() }, [fetchAll])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const selectAll = () => {
    const items = filteredItems()
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((i: { id: string }) => i.id)))
    }
  }

  const filteredItems = () => {
    const q = search.toLowerCase()
    if (activeTab === 'profiles') {
      return profiles.filter(p => p.name.toLowerCase().includes(q) || p.profileUid.toLowerCase().includes(q))
    }
    if (activeTab === 'accounts') {
      return accounts.filter(a => a.identifier.toLowerCase().includes(q) || a.typeName.toLowerCase().includes(q))
    }
    return proxies.filter(p => p.label.toLowerCase().includes(q) || p.rawProxy.toLowerCase().includes(q))
  }

  const handleStartProfiles = async () => {
    const ids = [...selectedIds]
    setProcessingIds(new Set(ids))
    let ok = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/profiles/${id}/start`, { method: 'POST' })
        const data = await res.json()
        if (data.success) ok++
      } catch { /* skip */ }
    }
    showToast(`Started ${ok}/${ids.length} profiles`, ok > 0 ? 'success' : 'error')
    setProcessingIds(new Set())
    setSelectedIds(new Set())
    fetchAll()
  }

  const handleStopProfiles = async () => {
    const ids = [...selectedIds]
    setProcessingIds(new Set(ids))
    let ok = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/profiles/${id}/stop`, { method: 'POST' })
        const data = await res.json()
        if (data.success) ok++
      } catch { /* skip */ }
    }
    showToast(`Stopped ${ok}/${ids.length} profiles`, ok > 0 ? 'success' : 'error')
    setProcessingIds(new Set())
    setSelectedIds(new Set())
    fetchAll()
  }

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected items?`)) return
    const ids = [...selectedIds]
    let ok = 0
    const endpoint = activeTab === 'profiles' ? 'profiles' : activeTab === 'accounts' ? 'accounts' : 'proxies'
    for (const id of ids) {
      try {
        const res = await fetch(`/api/${endpoint}/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (data.success) ok++
      } catch { /* skip */ }
    }
    showToast(`Deleted ${ok}/${ids.length}`, ok > 0 ? 'success' : 'error')
    setSelectedIds(new Set())
    fetchAll()
  }

  const handleCheckProxies = async () => {
    const ids = [...selectedIds]
    setProcessingIds(new Set(ids))
    let ok = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/proxies/${id}/check`, { method: 'POST' })
        const data = await res.json()
        if (data.success) ok++
      } catch { /* skip */ }
    }
    showToast(`Checked ${ok}/${ids.length} proxies`, ok > 0 ? 'success' : 'error')
    setProcessingIds(new Set())
    setSelectedIds(new Set())
    fetchAll()
  }

  const items = filteredItems()
  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'profiles', label: 'Profiles', icon: <Globe size={14} />, count: profiles.length },
    { key: 'accounts', label: 'Accounts', icon: <Users size={14} />, count: accounts.length },
    { key: 'proxies', label: 'Proxies', icon: <Shield size={14} />, count: proxies.length },
  ]

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      running: 'bg-emerald-500/20 text-emerald-300',
      idle: 'bg-gray-500/20 text-gray-400',
      active: 'bg-emerald-500/20 text-emerald-300',
      dead: 'bg-red-500/20 text-red-300',
      error: 'bg-red-500/20 text-red-300',
      checking: 'bg-yellow-500/20 text-yellow-300',
      starting: 'bg-yellow-500/20 text-yellow-300',
      stopping: 'bg-yellow-500/20 text-yellow-300',
    }
    return map[status] || 'bg-gray-500/20 text-gray-400'
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
        <div className="rounded-xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 border-b animate-pulse" style={{ backgroundColor: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-2)', borderColor: 'var(--border-color)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Workspace</h1>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
          style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={12} /> Refresh All
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()); setSearch('') }}
            className={`rounded-xl border p-3 text-left transition-all ${activeTab === tab.key ? 'ring-1' : 'hover:bg-white/5'}`}
            style={{
              backgroundColor: activeTab === tab.key ? 'var(--accent)' : 'var(--bg-surface)',
              borderColor: activeTab === tab.key ? 'var(--accent)' : 'var(--border-color)',
              color: activeTab === tab.key ? 'white' : 'var(--text-primary)',
              ...(activeTab === tab.key ? { ringColor: 'var(--accent)' } : {}),
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              {tab.icon}
              <span className="text-xs font-medium">{tab.label}</span>
            </div>
            <div className="text-xl font-bold">{tab.count}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border p-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Select all */}
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border"
            style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            <CheckSquare size={12} />
            {selectedIds.size === items.length && items.length > 0 ? 'Deselect All' : 'Select All'}
          </button>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium px-2" style={{ color: 'var(--accent)' }}>{selectedIds.size} selected</span>
              {activeTab === 'profiles' && (
                <>
                  <button onClick={handleStartProfiles} className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors" disabled={processingIds.size > 0}>
                    <Play size={12} /> Start
                  </button>
                  <button onClick={handleStopProfiles} className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors" disabled={processingIds.size > 0}>
                    <Square size={12} /> Stop
                  </button>
                </>
              )}
              {activeTab === 'proxies' && (
                <button onClick={handleCheckProxies} className="flex items-center gap-1 px-3 py-2 text-white rounded-lg text-xs font-medium transition-colors" style={{ backgroundColor: 'var(--accent)' }} disabled={processingIds.size > 0}>
                  <Search size={12} /> Check
                </button>
              )}
              <button onClick={handleDeleteSelected} className="flex items-center gap-1 px-3 py-2 bg-red-600/80 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        {items.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            <div className="text-2xl mb-2">📭</div>
            <div className="text-sm">No {activeTab} found</div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {(items as Array<Profile | Account | Proxy>).map((item) => {
              const isSelected = selectedIds.has(item.id)
              const isProcessing = processingIds.has(item.id)

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/5'} ${isProcessing ? 'opacity-60' : ''}`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded border-white/10 accent-indigo-500 flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {activeTab === 'profiles' && (() => {
                      const p = item as Profile
                      return (
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {p.profileUid.substring(0, 12)}... {p.proxy ? `• ${p.proxy.label}` : ''} {p.group ? `• ${p.group.name}` : ''}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusColor(p.status)}`}>
                            {p.status}
                          </span>
                          {p._count && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-muted)' }}>
                              {p._count.accounts} acc
                            </span>
                          )}
                        </div>
                      )
                    })()}
                    {activeTab === 'accounts' && (() => {
                      const a = item as Account
                      return (
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.identifier}</div>
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {a.typeName} {a.profile ? `• ${a.profile.name}` : '• No profile'}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusColor(a.status)}`}>
                            {a.status || 'active'}
                          </span>
                        </div>
                      )
                    })()}
                    {activeTab === 'proxies' && (() => {
                      const x = item as Proxy
                      return (
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{x.label}</div>
                            <div className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                              {x.rawProxy}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusColor(x.status)}`}>
                            {x.status}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-muted)' }}>
                            {x._count.profiles}p / {x._count.accounts}a
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="text-center text-xs py-2" style={{ color: 'var(--text-muted)' }}>
        {items.length} {activeTab} • {selectedIds.size} selected
      </div>
    </div>
  )
}
