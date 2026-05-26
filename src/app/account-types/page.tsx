'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import Modal from '@/components/Modal'
import { Plus, Download, Edit2, Trash2, Search, Link as LinkIcon, Database } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { SearchInput } from '@/components/ui/Input'

interface AccountType {
  id: string
  name: string
  label: string
  description: string | null
  icon: string | null
  loginUrl: string | null
  isSystem: boolean
  isActive: boolean
  sortOrder: number
  _count?: { accounts: number }
}

export default function AccountTypesPage() {
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { showToast } = useToastContext()

  const [formData, setFormData] = useState({
    name: '', label: '', description: '', icon: '', loginUrl: '', sortOrder: 0, isActive: true,
  })

  useEffect(() => { fetchAccountTypes() }, [])

  const fetchAccountTypes = async () => {
    try {
      const res = await fetch('/api/account-types?includeInactive=true')
      const data = await res.json()
      if (data.success) setAccountTypes(data.accountTypes || [])
    } catch {
      showToast('Error loading account types', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/account-types', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Account type created', 'success')
        setShowAddModal(false); resetForm(); fetchAccountTypes()
      } else showToast(data.error || 'Failed', 'error')
    } catch { showToast('Error creating account type', 'error') }
  }

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch(`/api/account-types/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Account type updated', 'success')
        setEditingId(null); resetForm(); fetchAccountTypes()
      } else showToast(data.error || 'Failed', 'error')
    } catch { showToast('Error updating account type', 'error') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account type?')) return
    try {
      const res = await fetch(`/api/account-types/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { showToast('Deleted', 'success'); fetchAccountTypes() }
      else showToast(data.error || 'Failed', 'error')
    } catch { showToast('Error deleting', 'error') }
  }

  const handleEdit = (t: AccountType) => {
    setEditingId(t.id)
    setFormData({ name: t.name, label: t.label, description: t.description || '', icon: t.icon || '', loginUrl: t.loginUrl || '', sortOrder: t.sortOrder, isActive: t.isActive })
  }

  const resetForm = () => setFormData({ name: '', label: '', description: '', icon: '', loginUrl: '', sortOrder: 0, isActive: true })

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />)}
      </div>
    )
  }

  const filteredTypes = accountTypes.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Account Types</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {accountTypes.length} types &middot; {accountTypes.filter(t => t.isActive).length} active
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={async () => {
            showToast('Migrating...', 'info')
            try {
              const res = await fetch('/api/account-types/migrate', { method: 'POST' })
              const data = await res.json()
              if (data.success) { showToast(`Migrated: ${data.accountTypesCreated} types, ${data.accountsUpdated} accounts`, 'success'); fetchAccountTypes() }
              else showToast(data.error || 'Migration failed', 'error')
            } catch { showToast('Migration failed', 'error') }
          }}>
            <Download size={14} />
            <span className="hidden sm:inline">Migrate</span>
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setShowAddModal(true) }}>
            <Plus size={14} />
            <span className="hidden sm:inline">Add Type</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <SearchInput
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search account types..."
        className="max-w-sm"
      />

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredTypes.map((type) => (
          <Card key={type.id}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: type.isActive ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-surface-2)' }}
                >
                  {type.icon || '📦'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-semibold truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }} title={type.label}>{type.label}</h3>
                    {type.isSystem && <Badge variant="info" size="sm">SYS</Badge>}
                    <span className={`w-2 h-2 rounded-full ${type.isActive ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                  </div>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{type.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(type)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" style={{ color: 'var(--text-muted)' }} title="Edit">
                  <Edit2 size={14} />
                </button>
                {!type.isSystem && (
                  <button onClick={() => handleDelete(type.id)} className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors text-red-400" title="Delete">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {type.description && (
              <p className="text-[11px] line-clamp-1 mt-2" style={{ color: 'var(--text-secondary)' }}>{type.description}</p>
            )}

            <div className="flex items-center justify-between gap-2 mt-3 text-xs p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-surface-2)' }}>
              <div className="flex items-center gap-1.5 min-w-0">
                <LinkIcon size={12} style={{ color: 'var(--text-muted)' }} />
                {type.loginUrl ? (
                  <a href={type.loginUrl} target="_blank" rel="noreferrer" className="truncate font-medium" style={{ color: 'var(--accent)' }}>{type.loginUrl}</a>
                ) : (
                  <span className="truncate" style={{ color: 'var(--text-muted)' }}>Auto-detect</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 pl-2 border-l" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                <Database size={12} />
                <span className="font-semibold">{type._count?.accounts || 0}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredTypes.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <Search size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No account types found</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal || editingId !== null}
        onClose={() => { setShowAddModal(false); setEditingId(null); resetForm() }}
        title={editingId ? 'Edit Account Type' : 'Add Account Type'}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {!editingId && (
            <div className="md:col-span-6">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1"
                style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                placeholder="e.g., instagram"
              />
              <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>Lowercase, numbers, _, - only</p>
            </div>
          )}
          <div className={!editingId ? "md:col-span-6" : "md:col-span-12"}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Label <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1"
              style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              placeholder="e.g., Instagram"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Icon</label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1"
              style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              placeholder="📷"
              maxLength={2}
            />
          </div>
          <div className="md:col-span-8">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Sort Order</label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1"
              style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="md:col-span-12">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Start URL <span className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.loginUrl}
              onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1"
              style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              placeholder="https://..."
            />
          </div>
          <div className="md:col-span-12">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 resize-none"
              style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              placeholder="What is this account type used for?"
            />
          </div>
          {editingId && (
            <div className="md:col-span-12 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${formData.isActive ? 'bg-indigo-600' : ''}`}
                  style={!formData.isActive ? { backgroundColor: 'var(--bg-surface-2)' } : undefined}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${formData.isActive ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active</span>
              </label>
            </div>
          )}
          <div className="md:col-span-12 flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setEditingId(null); resetForm() }}>Cancel</Button>
            <Button onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
