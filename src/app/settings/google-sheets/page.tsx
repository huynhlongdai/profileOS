'use client'

import { useEffect, useState, useCallback } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import { RefreshCw, ExternalLink, CheckCircle, Sheet } from 'lucide-react'
import Card, { CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

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
  const [config, setConfig] = useState<GoogleSheetsConfig>({ gasWebAppUrl: '', secretToken: '', autoSync: false, autoSyncIntervalMinutes: 60 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastPushResult, setLastPushResult] = useState<PushResult | null>(null)
  const { showToast } = useToastContext()

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/google-sheets/config')
      const data = await res.json()
      if (data.success && data.config) setConfig(data.config)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const saveConfig = async () => {
    if (!config.gasWebAppUrl.trim()) { showToast('Enter GAS Web App URL', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/google-sheets/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      const data = await res.json()
      if (data.success) { showToast('Config saved', 'success'); setConfig(data.config) }
      else showToast(data.error || 'Failed', 'error')
    } catch { showToast('Server error', 'error') } finally { setSaving(false) }
  }

  const syncNow = async () => {
    if (!config.gasWebAppUrl.trim()) { showToast('Configure GAS URL first', 'error'); return }
    setSyncing(true)
    try {
      const res = await fetch('/api/google-sheets/push', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setLastPushResult(data.pushed)
        setConfig(prev => ({ ...prev, lastSync: data.pushed.timestamp }))
        showToast(`Synced ${data.pushed.accounts} accounts, ${data.pushed.profiles} profiles`, 'success')
      } else showToast(data.error || 'Sync failed', 'error')
    } catch { showToast('Server error', 'error') } finally { setSyncing(false) }
  }

  const testConnection = async () => {
    if (!config.gasWebAppUrl.trim()) { showToast('Enter URL first', 'error'); return }
    setSyncing(true)
    try {
      const testPayload = {
        secretToken: config.secretToken, timestamp: new Date().toISOString(),
        accounts: [{ index: 1, label: 'TEST', accountType: 'test', identifier: 'test@test.com', status: 'active', notes: 'Connection test', profileName: '', proxyLabel: '', lastLogin: '', updatedAt: new Date().toISOString() }],
        profiles: [],
      }
      const res = await fetch(config.gasWebAppUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(testPayload) })
      if (res.ok) showToast('Connection successful!', 'success')
      else showToast(`GAS returned ${res.status}`, 'error')
    } catch { showToast('Cannot connect. Use "Sync Now" to test from server.', 'error') } finally { setSyncing(false) }
  }

  const formatDateTime = (iso?: string) => {
    if (!iso) return null
    return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        {[1, 2].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />)}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Google Sheets Sync</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Push accounts & profiles to Google Sheets</p>
      </div>

      {/* Info */}
      <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(99, 102, 241, 0.3)', backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          <strong>How it works:</strong> ProfileOS → POST JSON → GAS Web App (HTTPS) → Google Sheet
        </p>
      </div>

      {/* Config */}
      <Card>
        <CardHeader title="Configuration" />
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              GAS Web App URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={config.gasWebAppUrl}
              onChange={e => setConfig({ ...config, gasWebAppUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-1"
              style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>URL from Deploy → Web App</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Secret Token</label>
            <input
              type="text"
              value={config.secretToken}
              onChange={e => setConfig({ ...config, secretToken: e.target.value })}
              placeholder="Must match SECRET_TOKEN in Code.gs"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveConfig} loading={saving}>Save</Button>
            <Button variant="secondary" onClick={testConnection} loading={syncing}>Test</Button>
          </div>
        </div>
      </Card>

      {/* Sync */}
      <Card>
        <CardHeader title="Sync" description="Push all data to Google Sheets (overwrites existing)" />
        {config.lastSync && (
          <div className="mb-3 rounded-lg p-2.5" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)' }}>
            <p className="text-xs" style={{ color: 'var(--color-success)' }}>
              Last sync: <strong>{formatDateTime(config.lastSync)}</strong>
              {lastPushResult && <span> ({lastPushResult.accounts} accounts, {lastPushResult.profiles} profiles)</span>}
            </p>
          </div>
        )}
        <Button onClick={syncNow} loading={syncing} disabled={!config.gasWebAppUrl}>
          <RefreshCw size={14} /> Sync Now
        </Button>
      </Card>

      {/* Setup Guide */}
      <Card>
        <CardHeader title="Setup Guide" />
        <ol className="space-y-3 text-xs">
          {[
            { title: 'Open Google Sheets', desc: 'Create a new spreadsheet at sheets.google.com' },
            { title: 'Open Apps Script', desc: 'Extensions → Apps Script → Paste Code.gs content' },
            { title: 'Set Secret Token', desc: 'Edit SECRET_TOKEN in Code.gs' },
            { title: 'Deploy Web App', desc: 'Deploy → New deployment → Web app (Execute as: Me, Anyone)' },
            { title: 'Paste URL & Sync', desc: 'Paste URL above → Save → Sync Now' },
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-indigo-600 text-white">{i + 1}</span>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{step.title}</p>
                <p style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-3 rounded-lg p-2.5 text-xs" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-warning)' }}>
          After editing Code.gs, create a <strong>New deployment</strong> (not edit existing) for changes to take effect.
        </div>
      </Card>
    </div>
  )
}
