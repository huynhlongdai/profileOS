'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from './ToastProvider'

interface Proxy {
  id: string
  label: string
  rawProxy: string
}

interface ProxySelectorProps {
  accountId?: string                   // Optional: if editing an account
  profileId?: string                   // Optional: if editing a profile
  currentProxyId?: string | null       // Account's own proxyId (or Profile's own)
  currentProxyLabel?: string | null    // Account's own proxy label
  inheritedProxyId?: string | null     // Proxy inherited from profile
  inheritedProxyLabel?: string | null  // Label of inherited proxy
  onSuccess?: () => void
}

export default function ProxySelector({
  accountId,
  profileId,
  currentProxyId,
  currentProxyLabel,
  inheritedProxyId,
  inheritedProxyLabel,
  onSuccess,
}: ProxySelectorProps) {
  const [proxies, setProxies] = useState<Proxy[]>([])
  // Use account's own proxy if set, otherwise fall back to inherited proxy as display value
  const effectiveId = currentProxyId || inheritedProxyId || ''
  const [selectedId, setSelectedId] = useState<string>(effectiveId)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const { showToast } = useToastContext()

  // Keep in sync when parent props change
  useEffect(() => {
    setSelectedId(currentProxyId || inheritedProxyId || '')
  }, [currentProxyId, inheritedProxyId])

  // Lazy-load proxy list on first focus/open
  const loadProxies = async () => {
    if (loaded) return
    try {
      const res = await fetch('/api/proxies')
      const data = await res.json()
      if (data.success) setProxies(data.proxies || [])
    } catch (e) {
      console.error('ProxySelector: error loading proxies', e)
    } finally {
      setLoaded(true)
    }
  }

  const handleChange = async (newProxyId: string) => {
    if (newProxyId === selectedId) return
    setSelectedId(newProxyId)
    setSaving(true)
    try {
      const endpoint = accountId 
        ? `/api/accounts/${accountId}` 
        : `/api/profiles/${profileId}`

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxyId: newProxyId || null }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Proxy updated', 'success')
        onSuccess?.()
      } else {
        showToast(data.error || 'Failed to update proxy', 'error')
        setSelectedId(currentProxyId || inheritedProxyId || '')
      }
    } catch (e) {
      showToast('Network error updating proxy', 'error')
      setSelectedId(currentProxyId || inheritedProxyId || '')
    } finally {
      setSaving(false)
    }
  }

  // Is the currently shown proxy inherited (not account's own)?
  const isInherited = !currentProxyId && !!inheritedProxyId && selectedId === inheritedProxyId

  return (
    <div className="relative inline-block min-w-[130px] max-w-[190px]">
      {saving && (
        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs animate-pulse z-10"
              style={{ color: 'var(--text-muted)' }}>
          ⏳
        </span>
      )}
      <select
        value={selectedId}
        onFocus={loadProxies}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="w-full rounded border px-2 py-0.5 text-xs focus:outline-none focus:ring-1 disabled:opacity-50 cursor-pointer transition-colors"
        style={{
          borderColor: isInherited ? 'rgba(129,140,248,0.4)' : 'var(--border-color)',
          backgroundColor: isInherited ? 'rgba(129,140,248,0.08)' : 'var(--bg-surface-2)',
          color: isInherited ? 'var(--accent)' : 'var(--text-secondary)',
        }}
        title={isInherited
          ? `📌 Kế thừa từ profile: ${inheritedProxyLabel || selectedId}`
          : (currentProxyLabel || 'No proxy')}
      >
        <option value="">— No Proxy —</option>

        {/* Show current/inherited proxy even if full list not loaded yet */}
        {!loaded && effectiveId && (
          <option value={effectiveId}>
            {isInherited ? `📌 ${inheritedProxyLabel || effectiveId}` : (currentProxyLabel || effectiveId)}
          </option>
        )}

        {loaded && proxies.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {/* Inherited indicator below */}
      {isInherited && !saving && (
        <div className="text-[9px] mt-0.5 leading-none" style={{ color: 'var(--accent)', opacity: 0.7 }}>
          📌 profile
        </div>
      )}
    </div>
  )
}
