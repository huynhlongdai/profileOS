'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from './ToastProvider'

interface ProfileDetail {
    id: string
    name: string
    profileUid: string
    status: string
    browserType: string | null
    browserProvider: string | null
    lastOpened: string | null
    lastClosed: string | null
    autoResetIp: boolean
    groupId: number | null
    proxy: { label: string; rawProxy: string } | null
    executablePath: string | null
    accounts: {
        id: string
        label: string
        accountType: string
        identifier: string
        status: string
    }[]
    createdAt: string
    updatedAt: string
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

interface ProfileDetailModalProps {
    isOpen: boolean
    onClose: () => void
    profileId: string | null
}

export default function ProfileDetailModal({
    isOpen,
    onClose,
    profileId,
}: ProfileDetailModalProps) {
    const [profile, setProfile] = useState<ProfileDetail | null>(null)
    const [changeHistory, setChangeHistory] = useState<ChangeHistory[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [activeTab, setActiveTab] = useState<'info' | 'accounts' | 'history'>('info')
    const [isEditingPath, setIsEditingPath] = useState(false)
    const [tempPath, setTempPath] = useState('')
    const { showToast } = useToastContext()

    useEffect(() => {
        if (isOpen && profileId) {
            fetchProfileDetail()
            fetchChangeHistory()
        } else {
            setProfile(null)
            setChangeHistory([])
            setActiveTab('info')
        }
    }, [isOpen, profileId])

    const fetchProfileDetail = async () => {
        if (!profileId) return
        setLoading(true)
        try {
            const res = await fetch(`/api/profiles/${profileId}`)
            const data = await res.json()
            if (data.success) {
                setProfile(data.profile)
            } else {
                showToast('Error loading profile details', 'error')
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
            showToast('Error loading profile details', 'error')
        } finally {
            setLoading(false)
        }
    }

    const fetchChangeHistory = async () => {
        if (!profileId) return
        setLoadingHistory(true)
        try {
            const res = await fetch(`/api/profiles/${profileId}/change-history?limit=50`)
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
        if (!profileId) return
        if (!confirm('Bạn có chắc muốn xóa bản ghi lịch sử này?')) return

        try {
            const res = await fetch(`/api/profiles/${profileId}/change-history/${historyId}`, {
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
        if (!profileId) return
        if (!confirm('Bạn có chắc muốn xóa tất cả lịch sử thay đổi? Hành động này không thể hoàn tác.')) return

        try {
            const res = await fetch(`/api/profiles/${profileId}/change-history`, {
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

    const handleUpdatePath = async () => {
        if (!profileId) return
        setLoading(true)
        try {
            const res = await fetch(`/api/profiles/${profileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ executablePath: tempPath }),
            })
            const data = await res.json()
            if (data.success) {
                showToast('Đã cập nhật đường dẫn Chrome', 'success')
                setIsEditingPath(false)
                fetchProfileDetail()
                fetchChangeHistory() // Refresh history to show the change
            } else {
                showToast(data.error || 'Lỗi khi cập nhật đường dẫn', 'error')
            }
        } catch (error) {
            console.error('Error updating path:', error)
            showToast('Lỗi khi cập nhật đường dẫn', 'error')
        } finally {
            setLoading(false)
        }
    }

    const getChangeTypeLabel = (changeType: string) => {
        const labels: Record<string, string> = {
            name: 'Tên Profile',
            proxy: 'Proxy',
            status: 'Trạng thái',
            group: 'Nhóm',
            auto_reset_ip: 'Auto Reset IP',
            other: 'Khác',
        }
        return labels[changeType] || changeType
    }

    const getChangeTypeColor = (changeType: string) => {
        const colors: Record<string, string> = {
            name: 'bg-blue-100 text-blue-800',
            proxy: 'bg-orange-100 text-orange-800',
            status: 'bg-yellow-100 text-yellow-800',
            group: 'bg-purple-100 text-purple-800',
            auto_reset_ip: 'bg-green-100 text-green-800',
            other: 'bg-gray-100 text-gray-800',
        }
        return colors[changeType] || 'bg-gray-100 text-gray-800'
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
                            {profile ? `Profile Detail: ${profile.name}` : 'Profile Detail'}
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-500 text-2xl font-bold">
                            &times;
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-4">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2"></div>
                                <p className="text-gray-500">Loading profile details...</p>
                            </div>
                        ) : !profile ? (
                            <div className="text-center py-12 text-gray-500">Profile not found</div>
                        ) : (
                            <div className="space-y-6">
                                {/* Tabs */}
                                <div className="flex gap-4 border-b">
                                    <button
                                        onClick={() => setActiveTab('info')}
                                        className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'info'
                                            ? 'text-blue-600 border-b-2 border-blue-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        ℹ️ General Info
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('accounts')}
                                        className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'accounts'
                                            ? 'text-blue-600 border-b-2 border-blue-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        👥 Linked Accounts ({profile.accounts?.length || 0})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('history')}
                                        className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'history'
                                            ? 'text-blue-600 border-b-2 border-blue-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        📜 Change History ({changeHistory.length})
                                    </button>
                                </div>

                                {/* Tab Content */}
                                <div className="max-h-[60vh] overflow-y-auto pr-2">
                                    {/* General Info Tab */}
                                    {activeTab === 'info' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <section>
                                                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Basic Info</h4>
                                                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-gray-500">Name</span>
                                                            <span className="text-sm font-medium">{profile.name}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-gray-500">UID</span>
                                                            <span className="text-sm font-mono text-xs">{profile.profileUid}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-gray-500">Browser</span>
                                                            <span className="text-sm font-medium capitalize">{profile.browserType} ({profile.browserProvider})</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-gray-500">Status</span>
                                                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${profile.status === 'running' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                                {profile.status.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </section>

                                                <section>
                                                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Proxy & Network</h4>
                                                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-gray-500">Proxy</span>
                                                            <span className="text-sm font-medium">{profile.proxy?.label || 'Direct Connection'}</span>
                                                        </div>
                                                        {profile.proxy?.rawProxy && (
                                                            <div className="text-right">
                                                                <span className="text-xs text-gray-400 bg-white px-2 py-1 rounded border overflow-hidden truncate block max-w-full">
                                                                    {profile.proxy.rawProxy}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between border-t pt-2 mt-2">
                                                            <span className="text-sm text-gray-500">Auto Reset IP</span>
                                                            <span className="text-sm font-medium">{profile.autoResetIp ? '✅ Enabled' : '❌ Disabled'}</span>
                                                        </div>
                                                    </div>
                                                </section>
                                            </div>

                                            <div className="space-y-4">
                                                <section>
                                                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Dates</h4>
                                                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-gray-500">Created</span>
                                                            <span className="text-sm font-medium">{new Date(profile.createdAt).toLocaleString('vi-VN')}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-gray-500">Last Opened</span>
                                                            <span className="text-sm font-medium">{profile.lastOpened ? new Date(profile.lastOpened).toLocaleString('vi-VN') : '-'}</span>
                                                        </div>
                                                        {profile.lastClosed && (
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-500">Last Closed</span>
                                                                <span className="text-sm font-medium">{new Date(profile.lastClosed).toLocaleString('vi-VN')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </section>

                                                <section>
                                                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">System</h4>
                                                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-gray-500">Internal ID</span>
                                                            <span className="text-sm font-mono text-xs">{profile.id}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-gray-500">Group ID</span>
                                                            <span className="text-sm font-medium">{profile.groupId || 'None'}</span>
                                                        </div>
                                                        <div className="border-t pt-2 mt-2">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-sm text-gray-500">Executable Path</span>
                                                                <button
                                                                    onClick={() => {
                                                                        setTempPath(profile.executablePath || '')
                                                                        setIsEditingPath(true)
                                                                    }}
                                                                    className="text-xs text-blue-600 hover:underline"
                                                                >
                                                                    Sửa
                                                                </button>
                                                            </div>
                                                            {isEditingPath ? (
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={tempPath}
                                                                        onChange={(e) => setTempPath(e.target.value)}
                                                                        className="text-xs border rounded px-2 py-1 flex-1"
                                                                        placeholder="Đường dẫn chrome.exe"
                                                                    />
                                                                    <button
                                                                        onClick={handleUpdatePath}
                                                                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                                                                    >
                                                                        Lưu
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setIsEditingPath(false)}
                                                                        className="text-xs bg-gray-200 px-2 py-1 rounded"
                                                                    >
                                                                        Hủy
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-mono break-all block text-gray-600 bg-white p-1 rounded border">
                                                                    {profile.executablePath || 'Default'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </section>
                                            </div>
                                        </div>
                                    )}

                                    {/* Accounts Tab */}
                                    {activeTab === 'accounts' && (
                                        <div className="space-y-3">
                                            {profile.accounts && profile.accounts.length > 0 ? (
                                                <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
                                                    <table className="min-w-full divide-y divide-gray-200">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label / Type</th>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Identifier</th>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200">
                                                            {profile.accounts.map((acc) => (
                                                                <tr key={acc.id} className="hover:bg-gray-50">
                                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm font-medium text-gray-900">{acc.label}</span>
                                                                            <span className="text-xs text-gray-500 uppercase">{acc.accountType}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                                                        {acc.identifier}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${acc.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                            {acc.status}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                                    <p className="text-gray-500">Chưa có tài khoản nào được liên kết với profile này.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* History Tab */}
                                    {activeTab === 'history' && (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
                                                <span className="text-sm text-blue-700 font-medium">Lịch sử thay đổi thông tin profile</span>
                                                {changeHistory.length > 0 && (
                                                    <button
                                                        onClick={handleDeleteAllHistory}
                                                        className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                                    >
                                                        Xóa tất cả
                                                    </button>
                                                )}
                                            </div>

                                            {loadingHistory ? (
                                                <div className="text-center py-8">Loading history...</div>
                                            ) : changeHistory.length === 0 ? (
                                                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                                    <p className="text-gray-500">Chưa có lịch sử thay đổi nào.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {changeHistory.map((item) => (
                                                        <div
                                                            key={item.id}
                                                            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm relative group"
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${getChangeTypeColor(item.changeType)}`}>
                                                                        {getChangeTypeLabel(item.changeType)}
                                                                    </span>
                                                                    <span className="text-xs font-medium text-gray-700">{item.fieldName}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleDeleteHistory(item.id)}
                                                                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                                                                        title="Xóa bản ghi này"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <p className="text-sm text-gray-600 mb-3">{item.description}</p>

                                                            {(item.oldValue || item.newValue) && (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-md border border-gray-100">
                                                                    <div className="space-y-1">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Giá trị cũ</span>
                                                                        <div className="text-xs text-gray-700 break-words font-mono bg-white p-2 rounded border border-gray-200 min-h-[30px]">
                                                                            {item.oldValue || <span className="text-gray-300 italic">Trống</span>}
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <span className="text-[10px] font-bold text-blue-400 uppercase">Giá trị mới</span>
                                                                        <div className="text-xs text-blue-700 break-words font-mono bg-blue-50/50 p-2 rounded border border-blue-100 min-h-[30px]">
                                                                            {item.newValue || <span className="text-gray-300 italic">Trống</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {item.changedBy && (
                                                                <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-400">
                                                                    <span>👤 Thực hiện bởi:</span>
                                                                    <span className="font-bold text-gray-500">{item.changedBy}</span>
                                                                </div>
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

                    {/* Footer */}
                    <div className="flex justify-end gap-3 border-t px-6 py-4 bg-gray-50">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
