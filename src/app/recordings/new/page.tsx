'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToastContext } from '@/components/ToastProvider'

interface Account {
  id: string
  label: string
  accountType: string
  identifier: string
  profile: { id: string; name: string } | null
}

interface Profile {
  id: string
  name: string
  profileUid: string
  status: string
  proxy: { label: string; rawProxy: string } | null
}

interface AccountType {
  id: string
  name: string
  label: string
  icon: string | null
  isActive: boolean
}

export default function NewRecordingPage() {
  const router = useRouter()
  const { showToast } = useToastContext()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    accountType: '',
    accountId: '',
    profileId: '',
    testUrl: 'https://www.google.com',
  })

  useEffect(() => {
    // Fetch account types
    fetch('/api/account-types')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.accountTypes) {
          const activeTypes = data.accountTypes
            .filter((type: AccountType) => type.isActive)
            .sort((a: AccountType, b: AccountType) => {
              if ((a as any).sortOrder !== (b as any).sortOrder) {
                return (a as any).sortOrder - (b as any).sortOrder
              }
              return a.label.localeCompare(b.label)
            })
          setAccountTypes(activeTypes)
        }
      })
      .catch(console.error)

    fetch('/api/accounts?limit=1000')
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) {
          setAccounts(data.accounts)
        }
      })
      .catch(console.error)

    fetch('/api/profiles')
      .then((res) => res.json())
      .then((data) => {
        if (data.profiles) {
          setProfiles(data.profiles)
        }
      })
      .catch(console.error)
  }, [])

  const handleStartRecording = async () => {
    if (!formData.accountId && !formData.profileId) {
      showToast('Please select an account or profile', 'error')
      return
    }

    if (!formData.name.trim()) {
      showToast('Please enter a recording name', 'error')
      return
    }

    try {
      setRecording(true)
      setLoading(true)

      const res = await fetch('/api/recordings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: formData.accountId || undefined,
          profileId: formData.profileId || undefined,
          testUrl: formData.testUrl || 'https://www.google.com',
        }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast(`Recording completed! Recording ID: ${data.recordingId}`, 'success')
        router.push(`/recordings`)
      } else {
        const errorData = await res.json()
        const errorMessage = errorData.error || 'Failed to create recording'
        const errorDetails = errorData.details || ''
        const troubleshooting = errorData.troubleshooting || []

        // Show detailed error message
        let fullError = errorMessage
        if (errorDetails) {
          fullError += `: ${errorDetails}`
        }
        if (troubleshooting.length > 0) {
          fullError += `\n\nTroubleshooting:\n${troubleshooting.join('\n')}`
        }

        showToast(fullError, 'error')

        // Log detailed error for debugging
        console.error('[Recording] Error details:', errorData)
      }
    } catch (error) {
      console.error('Error creating recording:', error)
      showToast('Failed to create recording', 'error')
    } finally {
      setLoading(false)
      setRecording(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Create New Recording</h1>
          <p className="mt-2 text-sm text-gray-700">
            Create a new browser automation recording. Select an account or profile and start recording your actions.
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Recording Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recording Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Gmail Login Flow"
              className="block w-full rounded-md border-gray-300 text-gray-900 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={recording}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this recording does..."
              rows={3}
              className="block w-full rounded-md border-gray-300 text-gray-900 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={recording}
            />
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Type
            </label>
            <select
              value={formData.accountType}
              onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
              className="block w-full rounded-md border-gray-300 text-gray-900 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={recording}
            >
              <option value="" className="text-gray-900">-- Select Account Type --</option>
              {accountTypes.map((type) => (
                <option key={type.id} value={type.name} className="text-gray-900">
                  {type.icon ? `${type.icon} ` : ''}{type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Account
            </label>
            <select
              value={formData.accountId}
              onChange={(e) => {
                const account = accounts.find((a) => a.id === e.target.value)
                setFormData({
                  ...formData,
                  accountId: e.target.value,
                  accountType: account?.accountType || formData.accountType,
                  profileId: '', // Clear profile if account selected
                })
              }}
              className="block w-full rounded-md border-gray-300 text-gray-900 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={recording}
            >
              <option value="" className="text-gray-900">-- Select Account --</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id} className="text-gray-900">
                  {account.label} ({account.accountType}) - {account.identifier}
                </option>
              ))}
            </select>
          </div>

          <div className="text-center text-gray-500 text-sm">OR</div>

          {/* Profile Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Profile
            </label>
            <select
              value={formData.profileId}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  profileId: e.target.value,
                  accountId: '', // Clear account if profile selected
                })
              }}
              className="block w-full rounded-md border-gray-300 text-gray-900 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={recording}
            >
              <option value="" className="text-gray-900">-- Select Profile --</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id} className="text-gray-900">
                  {profile.name} ({profile.profileUid}) - {profile.status}
                  {profile.proxy && ` - Proxy: ${profile.proxy.label}`}
                </option>
              ))}
            </select>
          </div>

          {/* Test URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Starting URL
            </label>
            <input
              type="text"
              value={formData.testUrl}
              onChange={(e) => setFormData({ ...formData, testUrl: e.target.value })}
              placeholder="https://www.google.com"
              className="block w-full rounded-md border-gray-300 text-gray-900 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={recording}
            />
            <p className="mt-1 text-xs text-gray-500">
              The URL where the recording will start. Default: https://www.google.com
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              💡 GPM Automate Variables
            </h3>
            <p className="text-xs text-blue-800 mb-2">
              The following variables will be automatically collected during recording:
            </p>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li>
                <code className="bg-blue-100 px-1 rounded">$profileName</code> - Tên của profile đang mở
              </li>
              <li>
                <code className="bg-blue-100 px-1 rounded">$profileId</code> - ID của profile đang mở
              </li>
              <li>
                <code className="bg-blue-100 px-1 rounded">$profileProxy</code> - Proxy mà profile đang sử dụng
              </li>
              <li>
                <code className="bg-blue-100 px-1 rounded">$accountId</code> - Account ID (nếu có)
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => router.back()}
              disabled={recording}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleStartRecording}
              disabled={loading || recording || !formData.name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {recording ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Recording...
                </>
              ) : (
                <>
                  <span>🎬</span>
                  Start Recording
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

