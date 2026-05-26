'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from './ToastProvider'
import ProxySelector from './ProxySelector'
import ProfileDetailModal from './ProfileDetailModal'

interface AccountDetail {
  id: string
  label: string
  accountType: string
  identifier: string
  status: string
  twoFactorSecret: string | null
  cookiesJson: string | null
  createdAt: string
  updatedAt: string
  lastCheck: string | null
  lastLogin: string | null
  lastCare: string | null
  notes: string | null
  gpmloginProfileId: string | null
  proxyId: string | null
  profile: {
    id: string
    name: string
    proxy?: { label: string; rawProxy: string } | null
  } | null
  proxy: { id: string; label: string; rawProxy: string } | null
}

interface Log {
  id: string
  module: string
  type: string
  message: string
  metaJson: string | null
  createdAt: string
}

interface ChangeHistory {
  id: string
  changeType: string
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  description: string | null
  changedBy: string | null
  createdAt: string
}

interface AccountDetailModalProps {
  isOpen: boolean
  onClose: () => void
  accountId: string | null
}

export default function AccountDetailModal({
  isOpen,
  onClose,
  accountId,
}: AccountDetailModalProps) {
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [changeHistory, setChangeHistory] = useState<ChangeHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [activeTab, setActiveTab] = useState<'logs' | 'history'>('logs')
  const [password, setPassword] = useState<string | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState<string | null>(null)
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)
  const { showToast } = useToastContext()

  useEffect(() => {
    if (isOpen && accountId) {
      fetchAccountDetail()
      fetchLogs()
      fetchChangeHistory()
    } else {
      setAccount(null)
      setLogs([])
      setChangeHistory([])
      setPassword(null)
      setTwoFactorCode(null)
    }
  }, [isOpen, accountId])

  const fetchAccountDetail = async () => {
    if (!accountId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/accounts/${accountId}`)
      const data = await res.json()
      if (data.success) {
        setAccount(data.account)
      } else {
        showToast('Error loading account details', 'error')
      }
    } catch (error) {
      console.error('Error fetching account:', error)
      showToast('Error loading account details', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async () => {
    if (!accountId) return
    try {
      const res = await fetch(`/api/logs?accountId=${accountId}&limit=50`)
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    }
  }

  const fetchChangeHistory = async () => {
    if (!accountId) return
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/accounts/${accountId}/change-history?limit=50`)
      const data = await res.json()
      if (data.success) {
        setChangeHistory(data.history || [])
      }
    } catch (error) {
      console.error('Error fetching change history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDeleteHistory = async (historyId: string) => {
    if (!accountId) return
    if (!confirm('Bạn có chắc muốn xóa bản ghi lịch sử này?')) return

    try {
      const res = await fetch(`/api/accounts/${accountId}/change-history/${historyId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        showToast('Đã xóa bản ghi lịch sử', 'success')
        fetchChangeHistory()
      } else {
        showToast('Lỗi khi xóa bản ghi lịch sử', 'error')
      }
    } catch (error) {
      console.error('Error deleting history:', error)
      showToast('Lỗi khi xóa bản ghi lịch sử', 'error')
    }
  }

  const handleDeleteAllHistory = async () => {
    if (!accountId) return
    if (!confirm('Bạn có chắc muốn xóa tất cả lịch sử thay đổi? Hành động này không thể hoàn tác.')) return

    try {
      const res = await fetch(`/api/accounts/${accountId}/change-history`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Đã xóa ${data.deletedCount} bản ghi lịch sử`, 'success')
        fetchChangeHistory()
      } else {
        showToast('Lỗi khi xóa lịch sử', 'error')
      }
    } catch (error) {
      console.error('Error deleting all history:', error)
      showToast('Lỗi khi xóa lịch sử', 'error')
    }
  }

  const getChangeTypeLabel = (changeType: string) => {
    const labels: Record<string, string> = {
      password: 'Mật khẩu',
      identifier: 'Định danh',
      profile: 'Profile',
      proxy: 'Proxy',
      status: 'Trạng thái',
      notes: 'Ghi chú',
      '2fa': '2FA',
      login_method: 'Phương thức đăng nhập',
      label: 'Nhãn',
      other: 'Khác',
    }
    return labels[changeType] || changeType
  }

  const getChangeTypeColor = (changeType: string) => {
    const colors: Record<string, string> = {
      password: 'bg-red-100 text-red-800',
      identifier: 'bg-blue-100 text-blue-800',
      profile: 'bg-purple-100 text-purple-800',
      proxy: 'bg-orange-100 text-orange-800',
      status: 'bg-yellow-100 text-yellow-800',
      notes: 'bg-gray-100 text-gray-800',
      '2fa': 'bg-indigo-100 text-indigo-800',
      login_method: 'bg-pink-100 text-pink-800',
      label: 'bg-green-100 text-green-800',
      other: 'bg-gray-100 text-gray-800',
    }
    return colors[changeType] || 'bg-gray-100 text-gray-800'
  }

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${label} copied to clipboard`, 'success')
    } catch (error) {
      showToast(`Failed to copy ${label}`, 'error')
    }
  }

  const handleCopyAccount = () => {
    if (account) {
      handleCopy(account.identifier, 'Account')
    }
  }

  const handleCopyPassword = async () => {
    if (!accountId) return
    try {
      if (!password) {
        const res = await fetch(`/api/accounts/${accountId}/password`)
        const data = await res.json()
        if (data.success && data.password) {
          setPassword(data.password)
          await handleCopy(data.password, 'Password')
        } else {
          showToast('Password not found', 'info')
        }
      } else {
        await handleCopy(password, 'Password')
      }
    } catch (error) {
      showToast('Failed to get password', 'error')
    }
  }

  const handleCopy2FA = async () => {
    if (!accountId) return
    try {
      if (!twoFactorCode) {
        const res = await fetch(`/api/accounts/${accountId}/2fa`)
        const data = await res.json()
        if (data.success && data.twoFactorCode) {
          setTwoFactorCode(data.twoFactorCode)
          await handleCopy(data.twoFactorCode, '2FA Code')
        } else {
          showToast('2FA secret not found', 'info')
        }
      } else {
        await handleCopy(twoFactorCode, '2FA Code')
      }
    } catch (error) {
      showToast('Failed to get 2FA code', 'error')
    }
  }

  const handleCopyCookie = () => {
    if (!account || !account.cookiesJson) {
      showToast('No cookies found', 'info')
      return
    }
    try {
      const cookies = JSON.parse(account.cookiesJson)
      const cookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')
      handleCopy(cookieString, 'Cookies')
    } catch (error) {
      // If parsing fails, try to copy raw JSON
      handleCopy(account.cookiesJson, 'Cookies (JSON)')
    }
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

  const getLogTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    }
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[type] || 'bg-gray-100 text-gray-800'
          }`}
      >
        {type}
      </span>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative z-50 w-full max-w-4xl transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {account ? `Account Details: ${account.label}` : 'Account Details'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : !account ? (
              <div className="text-center py-8 text-gray-500">Account not found</div>
            ) : (
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Account Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Label</label>
                        <p className="text-sm text-gray-900">{account.label}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Type</label>
                        <p className="text-sm text-gray-900 capitalize">{account.accountType}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Identifier</label>
                        <p className="text-sm text-gray-900">{account.identifier}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <div>{getStatusBadge(account.status)}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Profile</label>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-900">{account.profile?.name || '-'}</p>
                          {(account.gpmloginProfileId || account.profile?.id) && (
                            <button
                              onClick={() => setViewingProfileId(account.gpmloginProfileId || account.profile?.id || null)}
                              className="px-2 py-0.5 text-xs font-medium text-teal-600 hover:text-white hover:bg-teal-600 border border-teal-300 rounded transition-colors"
                              title="Mở Profile"
                            >
                              👤 Open Profile
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Proxy</label>
                        <ProxySelector
                          accountId={account.id}
                          currentProxyId={account.proxyId || account.proxy?.id || null}
                          currentProxyLabel={account.profile?.proxy?.label || account.proxy?.label || null}
                          onSuccess={fetchAccountDetail}
                        />
                      </div>
                    </div>
                    {account.notes && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Notes</label>
                        <p className="text-sm text-gray-900">{account.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Timestamps</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Created At:</span>
                      <span className="text-sm text-gray-900">
                        {new Date(account.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Updated At:</span>
                      <span className="text-sm text-gray-900">
                        {new Date(account.updatedAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    {account.lastCheck && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Last Check:</span>
                        <span className="text-sm text-gray-900">
                          {new Date(account.lastCheck).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    )}
                    {account.lastLogin && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Last Login:</span>
                        <span className="text-sm text-gray-900">
                          {new Date(account.lastLogin).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    )}
                    {account.lastCare && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Last Care:</span>
                        <span className="text-sm text-gray-900">
                          {new Date(account.lastCare).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Copy Actions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Copy Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleCopyAccount}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      📋 Copy Account
                    </button>
                    <button
                      onClick={handleCopyPassword}
                      className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    >
                      🔑 Copy Password
                    </button>
                    {account.twoFactorSecret && (
                      <button
                        onClick={handleCopy2FA}
                        className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                      >
                        🔐 Copy 2FA Code
                      </button>
                    )}
                    {account.cookiesJson && (
                      <button
                        onClick={handleCopyCookie}
                        className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                      >
                        🍪 Copy Cookies
                      </button>
                    )}
                  </div>
                </div>

                {/* History/Logs Tabs */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">History</h3>
                    {activeTab === 'history' && changeHistory.length > 0 && (
                      <button
                        onClick={handleDeleteAllHistory}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      >
                        Xóa tất cả
                      </button>
                    )}
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 mb-4 border-b">
                    <button
                      onClick={() => setActiveTab('logs')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'logs'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Logs ({logs.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('history')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'history'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Change History ({changeHistory.length})
                    </button>
                  </div>

                  {/* Logs Tab */}
                  {activeTab === 'logs' && (
                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      {logs.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No logs found</p>
                      ) : (
                        <div className="space-y-2">
                          {logs.map((log) => (
                            <div
                              key={log.id}
                              className="bg-white rounded p-3 border border-gray-200 text-sm"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  {getLogTypeBadge(log.type)}
                                  <span className="font-medium text-gray-700">{log.module}</span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {new Date(log.createdAt).toLocaleString('vi-VN')}
                                </span>
                              </div>
                              <p className="text-gray-900">{log.message}</p>
                              {log.metaJson && (
                                <details className="mt-2">
                                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                    Show details
                                  </summary>
                                  <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(JSON.parse(log.metaJson), null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Change History Tab */}
                  {activeTab === 'history' && (
                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      {loadingHistory ? (
                        <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
                      ) : changeHistory.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Chưa có lịch sử thay đổi
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {changeHistory.map((history) => (
                            <div
                              key={history.id}
                              className="bg-white rounded p-3 border border-gray-200 text-sm"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${getChangeTypeColor(
                                      history.changeType
                                    )}`}
                                  >
                                    {getChangeTypeLabel(history.changeType)}
                                  </span>
                                  {history.fieldName && (
                                    <span className="text-xs text-gray-500">
                                      ({history.fieldName})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">
                                    {new Date(history.createdAt).toLocaleString('vi-VN')}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteHistory(history.id)}
                                    className="text-red-500 hover:text-red-700 text-xs"
                                    title="Xóa bản ghi này"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                              {history.description && (
                                <p className="text-gray-900 mb-2">{history.description}</p>
                              )}
                              {(history.oldValue || history.newValue) && (
                                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                  <div>
                                    <span className="text-gray-500">Từ:</span>
                                    <p className="text-gray-900 break-words">
                                      {history.oldValue || '(trống)'}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Đến:</span>
                                    <p className="text-gray-900 break-words">
                                      {history.newValue || '(trống)'}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {history.changedBy && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Thay đổi bởi: {history.changedBy}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ProfileDetailModal
        isOpen={viewingProfileId !== null}
        onClose={() => setViewingProfileId(null)}
        profileId={viewingProfileId}
      />
    </div>
  )
}

