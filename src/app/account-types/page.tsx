'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import Modal from '@/components/Modal'
import { Plus, Download, Edit2, Trash2, Search, Link as LinkIcon, ShieldCheck, Database, ServerCrash } from 'lucide-react'

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
    name: '',
    label: '',
    description: '',
    icon: '',
    loginUrl: '',
    sortOrder: 0,
    isActive: true,
  })

  useEffect(() => {
    fetchAccountTypes()
  }, [])

  const fetchAccountTypes = async () => {
    try {
      const res = await fetch('/api/account-types?includeInactive=true')
      const data = await res.json()
      if (data.success) {
        setAccountTypes(data.accountTypes || [])
      }
    } catch (error) {
      console.error('Error fetching account types:', error)
      showToast('Error loading account types', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/account-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Account type created successfully', 'success')
        setShowAddModal(false)
        resetForm()
        fetchAccountTypes()
      } else {
        showToast(data.error || 'Failed to create account type', 'error')
      }
    } catch (error) {
      console.error('Error creating account type:', error)
      showToast('Error creating account type', 'error')
    }
  }

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch(`/api/account-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Account type updated successfully', 'success')
        setEditingId(null)
        resetForm()
        fetchAccountTypes()
      } else {
        showToast(data.error || 'Failed to update account type', 'error')
      }
    } catch (error) {
      console.error('Error updating account type:', error)
      showToast('Error updating account type', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account type?')) {
      return
    }

    try {
      const res = await fetch(`/api/account-types/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        showToast('Account type deleted successfully', 'success')
        fetchAccountTypes()
      } else {
        showToast(data.error || 'Failed to delete account type', 'error')
      }
    } catch (error) {
      console.error('Error deleting account type:', error)
      showToast('Error deleting account type', 'error')
    }
  }

  const handleEdit = (accountType: AccountType) => {
    setEditingId(accountType.id)
    setFormData({
      name: accountType.name,
      label: accountType.label,
      description: accountType.description || '',
      icon: accountType.icon || '',
      loginUrl: accountType.loginUrl || '',
      sortOrder: accountType.sortOrder,
      isActive: accountType.isActive,
    })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      label: '',
      description: '',
      icon: '',
      loginUrl: '',
      sortOrder: 0,
      isActive: true,
    })
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  const filteredTypes = accountTypes.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="w-full px-4 sm:px-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Account Types</h1>
      </div>

      {/* Toolbar / Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
            placeholder="Search account types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={async () => {
              try {
                showToast('Đang migrate account types...', 'info')
                const res = await fetch('/api/account-types/migrate', { method: 'POST' })
                const data = await res.json()
                if (data.success) {
                  showToast(
                    `Migration thành công: ${data.accountTypesCreated} types, ${data.accountsUpdated} accounts đã được cập nhật`,
                    'success'
                  )
                  fetchAccountTypes()
                } else {
                  showToast(data.error || 'Migration failed', 'error')
                }
              } catch (error) {
                console.error('Error migrating account types:', error)
                showToast('Error migrating account types', 'error')
              }
            }}
            className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
          >
            <Download className="w-4 h-4" />
            Migrate
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowAddModal(true)
            }}
            className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium text-sm shadow-sm hover:shadow"
          >
            <Plus className="w-4 h-4" />
            Add Type
          </button>
        </div>
      </div>

      {/* Grid Layout replacing Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {filteredTypes.map((type) => (
          <div 
            key={type.id} 
            className="group bg-white p-3 flex flex-col rounded-xl shadow-sm hover:shadow-md border border-gray-200 transition-all duration-200"
          >
            {/* Top: Icon + Names + Actions */}
            <div className="flex justify-between items-start mb-2.5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-sm border border-gray-100 flex-shrink-0 ${type.isActive ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  {type.icon || '📦'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900 leading-none truncate max-w-[120px]" title={type.label}>{type.label}</h3>
                    {type.isSystem && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 bg-purple-100 px-1 py-0.5 rounded leading-none">SYS</span>
                    )}
                    <span className={`w-2 h-2 rounded-full ml-0.5 ${type.isActive ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]' : 'bg-gray-300'}`} title={type.isActive ? 'Active' : 'Inactive'} />
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono mt-1 truncate">{type.name}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => handleEdit(type)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors" title="Edit">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {!type.isSystem && (
                  <button onClick={() => handleDelete(type.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Middle: Description */}
            {type.description && (
              <p className="text-[11px] text-gray-600 line-clamp-1 mb-2.5" title={type.description}>
                {type.description}
              </p>
            )}

            {/* Bottom: Start URL + Acc Count side-by-side */}
            <div className="flex items-center justify-between gap-2 mt-auto text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div className="flex items-center gap-1.5 min-w-0">
                <LinkIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                {type.loginUrl ? (
                  <a href={type.loginUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate font-medium">
                    {type.loginUrl}
                  </a>
                ) : (
                  <span className="text-slate-500 truncate" title={`Auto: https://${type.name}`}>
                    {type.name.includes('.') ? `https://${type.name}` : `Auto-detect`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-gray-600 font-semibold flex-shrink-0 pl-2 border-l border-slate-200" title={`${type._count?.accounts || 0} Accounts`}>
                <Database className="w-3 h-3 text-gray-400" />
                <span>{type._count?.accounts || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal || editingId !== null}
        onClose={() => {
          setShowAddModal(false)
          setEditingId(null)
          resetForm()
        }}
        title={editingId ? 'Edit Account Type' : 'Add Account Type'}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {!editingId && (
            <div className="md:col-span-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="e.g., instagram"
              />
              <p className="mt-1.5 text-[11px] text-gray-500 font-medium">
                Lowercase letters, numbers, _, - only
              </p>
            </div>
          )}

          <div className={!editingId ? "md:col-span-6" : "md:col-span-12"}>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) =>
                setFormData({ ...formData, label: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              placeholder="e.g., Instagram"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Icon (Emoji)
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.icon}
                onChange={(e) =>
                  setFormData({ ...formData, icon: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-10 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="📷"
                maxLength={2}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                ✨
              </div>
            </div>
          </div>

          <div className="md:col-span-8">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Sort Order
            </label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sortOrder: parseInt(e.target.value) || 0,
                })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="md:col-span-12">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              Start URL <span className="text-xs font-normal text-gray-400 ml-1">(Optional)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.loginUrl}
                onChange={(e) =>
                  setFormData({ ...formData, loginUrl: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-10 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="https://..."
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LinkIcon className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500 font-medium">Tự động khởi chạy URL này khi bật trình duyệt. Nếu bỏ trống, Auto-detect theo tên (eg: blink.new)</p>
          </div>

          <div className="md:col-span-12">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
              placeholder="What is this account type used for?"
            />
          </div>

          {editingId && (
            <div className="md:col-span-12 pt-2 border-t border-gray-100">
              <label className="flex items-center cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
                <span className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">Kích hoạt (Active)</span>
              </label>
            </div>
          )}

          <div className="md:col-span-12 flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false)
                setEditingId(null)
                resetForm()
              }}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (editingId) {
                  handleUpdate(editingId)
                } else {
                  handleCreate()
                }
              }}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all shadow-sm"
            >
              {editingId ? 'Save Changes' : 'Create Type'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

