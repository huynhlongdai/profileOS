'use client'

import { useState, useEffect } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import Modal from '@/components/Modal'
import { Plug, Plus, Wifi, WifiOff } from 'lucide-react'
import Card, { CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

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

const EMPTY_FORM = { name: '', apiUrl: '', apiVersion: 'v3', providerType: 'gpmlogin', description: '', isDefault: false, isEnabled: true }
const PROVIDER_OPTIONS = [
  { value: 'gpmlogin', label: 'GPMLogin Local', presetUrl: 'http://127.0.0.1:19995', presetVersion: 'v3' },
  { value: 'gpmlogin_global', label: 'GPMLogin Global', presetUrl: 'http://127.0.0.1:9495', presetVersion: 'v1' },
  { value: 'chrome', label: 'Chrome', presetUrl: '', presetVersion: '' },
  { value: 'firefox', label: 'Firefox', presetUrl: '', presetVersion: '' },
]
const BUILTIN_IDS = ['local-gpm', 'global-gpm']

export default function BrowserConnectionsPage() {
  const [connections, setConnections] = useState<BrowserConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const { showToast } = useToastContext()
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM })

  useEffect(() => { fetchConnections() }, [])

  const fetchConnections = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/browser-connections')
      const data = await res.json()
      if (data.success) setConnections(data.connections || [])
    } catch { showToast('Error loading connections', 'error') } finally { setLoading(false) }
  }

  const applyProviderPreset = (providerType: string, setter: React.Dispatch<React.SetStateAction<typeof formData>>) => {
    const preset = PROVIDER_OPTIONS.find(p => p.value === providerType)
    if (!preset) return
    setter(prev => ({ ...prev, providerType, apiUrl: prev.apiUrl || preset.presetUrl, apiVersion: preset.presetVersion }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await fetch('/api/browser-connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      const data = await res.json()
      if (data.success) { showToast('Connection added', 'success'); setFormData({ ...EMPTY_FORM }); setShowAddModal(false); fetchConnections() }
      else showToast(data.error || 'Failed', 'error')
    } catch { showToast('Server error', 'error') } finally { setSaving(false) }
  }

  const openEdit = (conn: BrowserConnection) => {
    setEditingId(conn.id)
    setEditForm({ name: conn.name, apiUrl: conn.apiUrl, apiVersion: conn.apiVersion, providerType: conn.providerType, description: conn.description || '', isDefault: conn.isDefault, isEnabled: conn.isEnabled })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return; setSaving(true)
    try {
      const res = await fetch(`/api/browser-connections/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) })
      const data = await res.json()
      if (data.success) { showToast('Updated', 'success'); setEditingId(null); fetchConnections() }
      else showToast(data.error || 'Failed', 'error')
    } catch { showToast('Server error', 'error') } finally { setSaving(false) }
  }

  const handleTest = async (id: string, apiUrl?: string, apiVersion?: string) => {
    setTestingId(id)
    try {
      const res = id === 'draft'
        ? await fetch('/api/browser-connections/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiUrl, apiVersion }) })
        : await fetch(`/api/browser-connections/${id}/test`, { method: 'POST' })
      const data = await res.json()
      showToast(data.message || (data.ok ? 'Connected' : 'Failed'), data.ok ? 'success' : 'error')
    } catch { showToast('Test failed', 'error') } finally { setTestingId(null) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      const res = await fetch(`/api/browser-connections/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { showToast('Deleted', 'success'); fetchConnections() }
      else showToast(data.error || 'Failed', 'error')
    } catch { showToast('Server error', 'error') }
  }

  const formFields = (data: typeof formData, setData: React.Dispatch<React.SetStateAction<typeof formData>>, isEdit = false) => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name</label>
        <input type="text" required value={data.name} onChange={e => setData({ ...data, name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
          style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          placeholder="GPMLogin Local" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>API URL</label>
        <input type="url" required value={data.apiUrl} onChange={e => setData({ ...data, apiUrl: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-1"
          style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          placeholder="http://127.0.0.1:19995" />
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Local: 19995 · Global: 9495</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>API Version</label>
          <select value={data.apiVersion} onChange={e => setData({ ...data, apiVersion: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
            style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="v3">v3</option><option value="v2">v2</option><option value="v1">v1</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Provider</label>
          <select value={data.providerType} onChange={e => applyProviderPreset(e.target.value, setData)}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
            style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            disabled={isEdit && editingId ? BUILTIN_IDS.includes(editingId) : false}>
            {PROVIDER_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
        <textarea value={data.description} onChange={e => setData({ ...data, description: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none resize-none min-h-[60px]"
          style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={data.isDefault} onChange={e => setData({ ...data, isDefault: e.target.checked })} className="w-4 h-4 rounded" />
          Default
        </label>
        {'isEnabled' in data && (
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={(data as typeof editForm).isEnabled} onChange={e => setData({ ...data, isEnabled: e.target.checked } as typeof formData)} className="w-4 h-4 rounded" />
            Enabled
          </label>
        )}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        {[1, 2].map(i => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />)}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Browser Connections</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {connections.length} connections &middot; GPMLogin, GPMGlobal, Chrome, Firefox
          </p>
        </div>
        <Button size="sm" onClick={() => { setFormData({ ...EMPTY_FORM }); setShowAddModal(true) }}>
          <Plus size={14} />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </div>

      {/* Connections Grid */}
      {connections.length === 0 ? (
        <Card>
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <Plug size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No connections yet</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {connections.map(conn => (
            <Card key={conn.id} className={!conn.isEnabled ? 'opacity-60' : ''}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: conn.isEnabled ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-surface-2)' }}>
                    {conn.isEnabled ? <Wifi size={18} style={{ color: 'var(--accent)' }} /> : <WifiOff size={18} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{conn.name}</h3>
                      {conn.isDefault && <Badge variant="info" size="sm">Default</Badge>}
                      {!conn.isEnabled && <Badge variant="muted" size="sm">Disabled</Badge>}
                    </div>
                    <p className="text-xs font-mono mt-1 break-all" style={{ color: 'var(--text-secondary)' }}>{conn.apiUrl}</p>
                    {conn.description && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{conn.description}</p>}
                    <div className="mt-2 flex gap-1.5">
                      <Badge variant="default" size="sm">API {conn.apiVersion}</Badge>
                      <Badge variant="default" size="sm">
                        {PROVIDER_OPTIONS.find(p => p.value === conn.providerType)?.label || conn.providerType}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleTest(conn.id)} loading={testingId === conn.id}>
                    Test
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(conn)}>Edit</Button>
                  {!BUILTIN_IDS.includes(conn.id) && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(conn.id, conn.name)} style={{ color: 'var(--color-error)' }}>
                      Del
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Connection">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formFields(formData, setFormData)}
          <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <Button variant="secondary" size="sm" type="button" onClick={() => handleTest('draft', formData.apiUrl, formData.apiVersion)} loading={testingId === 'draft'}>
              Test URL
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingId} onClose={() => setEditingId(null)} title="Edit Connection" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formFields(editForm, setEditForm, true)}
          <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <Button variant="secondary" size="sm" type="button" onClick={() => handleTest('draft', editForm.apiUrl, editForm.apiVersion)} loading={testingId === 'draft'}>
              Test URL
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" type="button" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
