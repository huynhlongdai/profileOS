'use client'

import { useState, useEffect } from 'react'
import { useToastContext } from './ToastProvider'
import Modal from './Modal'
import ProxyForm from './ProxyForm'

interface ProfileFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  profileId?: string
}

interface Proxy {
  id: string
  label: string
  rawProxy: string
}

interface Group {
  id: number
  name: string
  sort?: number
}

export default function ProfileForm({
  isOpen,
  onClose,
  onSuccess,
  profileId,
}: ProfileFormProps) {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [connections, setConnections] = useState<any[]>([])
  const [showProxyModal, setShowProxyModal] = useState(false)
  const { showToast } = useToastContext()
  const [formData, setFormData] = useState({
    name: '',
    proxyId: '',
    groupId: '',
    autoResetIp: false,
    browserType: 'gpm' as 'chromium' | 'firefox' | 'gpm',
    browserProvider: 'gpmlogin' as 'gpmlogin' | 'gpmlogin_global' | 'chrome' | 'firefox',
    browserConnectionId: '',
    executablePath: '',
  })

  useEffect(() => {
    if (isOpen) {
      fetchProxies()
      fetchGroups()
      fetchConnections()
      if (profileId) {
        fetchProfile()
      } else {
        // Reset form for new profile
        setFormData({ name: '', proxyId: '', groupId: '', autoResetIp: false, browserType: 'gpm', browserProvider: 'gpmlogin', browserConnectionId: '', executablePath: '' })
      }
    }
  }, [isOpen, profileId])

  const fetchProxies = async () => {
    try {
      const res = await fetch('/api/proxies')
      const data = await res.json()
      if (data.success) {
        setProxies(data.proxies)
      }
    } catch (error) {
      console.error('Error fetching proxies:', error)
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

  const fetchProfile = async () => {
    if (!profileId) return

    try {
      setFetching(true)
      setLoading(true)
      const res = await fetch(`/api/profiles/${profileId}`)
      const data = await res.json()

      if (data.success && data.profile) {
        setFormData({
          name: data.profile.name || '',
          proxyId: data.profile.proxyId || '',
          groupId: data.profile.groupId ? data.profile.groupId.toString() : '',
          autoResetIp: data.profile.autoResetIp || false,
          browserType: (data.profile.browserType as 'chromium' | 'firefox' | 'gpm') || 'gpm',
          browserProvider: (data.profile.browserProvider as 'gpmlogin' | 'gpmlogin_global' | 'chrome' | 'firefox') || 'gpmlogin',
          browserConnectionId: data.profile.browserConnectionId || '',
          executablePath: data.profile.executablePath || '',
        })
      } else {
        showToast(data.error || 'Failed to load profile data', 'error')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      showToast('Error loading profile data', 'error')
    } finally {
      setLoading(false)
      setFetching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = profileId ? `/api/profiles/${profileId}` : '/api/profiles'
      const method = profileId ? 'PUT' : 'POST'

      const payload = {
        ...formData,
        browserConnectionId:
          formData.browserProvider === 'gpmlogin_global'
            ? 'global-gpm'
            : formData.browserProvider === 'gpmlogin'
              ? formData.browserConnectionId || 'local-gpm'
              : null,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (data.success) {
        showToast(
          profileId ? 'Profile updated successfully' : 'Profile created successfully',
          'success'
        )
        onSuccess()
        onClose()
        setFormData({ name: '', proxyId: '', groupId: '', autoResetIp: false, browserType: 'gpm', browserProvider: 'gpmlogin', browserConnectionId: '', executablePath: '' })
      } else {
        showToast(data.error || 'Unknown error', 'error')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      showToast('Error saving profile. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddNewProxy = () => {
    setShowProxyModal(true)
  }

  const handleProxyCreated = () => {
    setShowProxyModal(false)
    fetchProxies() // Refresh proxy list
    showToast('Proxy created. Please select it from the list.', 'success')
  }

  if (loading && profileId && formData.name === '') {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600">Loading profile data...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Profile Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="Profile Name"
              disabled={loading && profileId !== undefined}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Group
            </label>
            <select
              value={formData.groupId}
              onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              disabled={loading && profileId !== undefined}
            >
              <option value="" className="text-gray-900">-- No Group --</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id.toString()} className="text-gray-900">
                  {group.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Chọn nhóm để phân loại profile (tùy chọn)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Proxy
            </label>
            <div className="mt-1 flex gap-2">
              <select
                value={formData.proxyId}
                onChange={(e) => setFormData({ ...formData, proxyId: e.target.value })}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                disabled={loading && profileId !== undefined}
              >
                <option value="" className="text-gray-900">-- No Proxy --</option>
                {proxies.map((proxy) => (
                  <option key={proxy.id} value={proxy.id} className="text-gray-900">
                    {proxy.label} ({proxy.rawProxy})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddNewProxy}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                title="Thêm proxy mới"
              >
                ➕
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Chọn proxy từ danh sách hoặc thêm mới
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Browser Provider
            </label>
            <select
              value={formData.browserProvider}
              onChange={(e) => {
                const provider = e.target.value as 'gpmlogin' | 'chrome' | 'firefox' | 'gpmlogin_global'
                // Auto-set browserType based on provider
                let browserType: 'chromium' | 'firefox' | 'gpm' = 'gpm'
                if (provider === 'chrome') {
                  browserType = 'chromium'
                } else if (provider === 'firefox') {
                  browserType = 'firefox'
                } else {
                  browserType = 'gpm'
                }
                setFormData({
                  ...formData,
                  browserProvider: provider,
                  browserType,
                  browserConnectionId:
                    provider === 'gpmlogin_global'
                      ? 'global-gpm'
                      : provider === 'gpmlogin'
                        ? formData.browserConnectionId || 'local-gpm'
                        : '',
                })
              }}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              disabled={loading && profileId !== undefined}
            >
              <option value="gpmlogin" className="text-gray-900">GPMLogin (Local)</option>
              <option value="gpmlogin_global" className="text-gray-900">GPMLogin Global (Port 9495)</option>
              <option value="chrome" className="text-gray-900">Chrome Browser</option>
              <option value="firefox" className="text-gray-900">Firefox Browser</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Chọn trình duyệt để quản lý profile. GPMLogin được khuyến nghị cho tính năng anti-detect.
            </p>
          </div>

          {formData.browserProvider === 'gpmlogin' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Browser Connection (GPMLogin Instance)
              </label>
              <select
                value={formData.browserConnectionId}
                onChange={(e) => setFormData({ ...formData, browserConnectionId: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                disabled={loading && profileId !== undefined}
              >
                <option value="local-gpm" className="text-gray-900">GPMLogin Local (mặc định)</option>
                {connections.filter(c => c.providerType === 'gpmlogin' && c.id !== 'local-gpm').map((conn) => (
                  <option key={conn.id} value={conn.id} className="text-gray-900">
                    {conn.name} ({conn.apiUrl})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Chọn instance của GPMLogin để điều khiển profile này
              </p>
            </div>
          ) : null}

          {formData.browserProvider === 'chrome' || formData.browserProvider === 'firefox' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Browser Executable Path (Optional)
              </label>
              <input
                type="text"
                value={formData.executablePath}
                onChange={(e) =>
                  setFormData({ ...formData, executablePath: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder={formData.browserProvider === 'chrome' 
                  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                  : 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'}
                disabled={loading && profileId !== undefined}
              />
              <p className="mt-1 text-xs text-gray-500">
                Đường dẫn đến file thực thi của trình duyệt. Để trống để dùng đường dẫn mặc định.
              </p>
            </div>
          ) : null}

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.autoResetIp}
                onChange={(e) =>
                  setFormData({ ...formData, autoResetIp: e.target.checked })
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={loading && profileId !== undefined}
              />
              <span className="ml-2 text-sm text-gray-700">
                Tự động reset IP proxy trước khi mở profile
              </span>
            </label>
            <p className="mt-1 text-xs text-gray-500">
              Nếu bật, hệ thống sẽ tự động reset IP của proxy trước khi mở profile này
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : profileId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>

      {/* Add Proxy Modal */}
      <Modal
        isOpen={showProxyModal}
        onClose={() => setShowProxyModal(false)}
        title="Thêm Proxy Mới"
      >
        <ProxyForm
          isOpen={showProxyModal}
          onClose={() => setShowProxyModal(false)}
          onSuccess={handleProxyCreated}
        />
      </Modal>
    </>
  )
}

