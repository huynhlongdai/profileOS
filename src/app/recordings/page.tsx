'use client'

import { useEffect, useState, useCallback } from 'react'
import Modal from '@/components/Modal'
import { useToastContext } from '@/components/ToastProvider'

interface Recording {
  id: string
  name: string
  description: string | null
  accountType: string | null
  url: string | null
  version: string
  author: string | null
  tags: string[]
  actionCount: number
  durationMs: number | null
  status: 'draft' | 'published' | 'archived'
  createdAt: string
  updatedAt: string
  runCount?: number
}

interface Action {
  id: string
  type: string
  timestamp: number
  selector?: string
  description?: string
  [key: string]: any
}

interface RecordingDetail extends Recording {
  actions: Action[]
  metadata: {
    name: string
    description?: string
    accountType?: string
    url?: string
    author?: string
    tags?: string[]
    version?: string
  }
}

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
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [allRecordings, setAllRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewingRecording, setViewingRecording] = useState<RecordingDetail | null>(null)
  const [replayRecording, setReplayRecording] = useState<Recording | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [replayLoading, setReplayLoading] = useState(false)
  const [testRecording, setTestRecording] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const { showToast } = useToastContext()

  const fetchRecordings = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (typeFilter) params.append('accountType', typeFilter)
      if (searchQuery) params.append('search', searchQuery)

      const res = await fetch(`/api/recordings?${params.toString()}`)
      const data = await res.json()

      if (res.ok && data.recordings) {
        setAllRecordings(data.recordings)
      } else {
        showToast('Failed to fetch recordings', 'error')
      }
    } catch (error) {
      console.error('Error fetching recordings:', error)
      showToast('Failed to fetch recordings', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, searchQuery, showToast])

  useEffect(() => {
    fetchRecordings()
  }, [fetchRecordings])

  useEffect(() => {
    // Filter recordings
    let filtered = [...allRecordings]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          (r.description && r.description.toLowerCase().includes(query))
      )
    }

    if (statusFilter) {
      filtered = filtered.filter((r) => r.status === statusFilter)
    }

    if (typeFilter) {
      filtered = filtered.filter((r) => r.accountType === typeFilter)
    }

    // Sort by updatedAt (newest first)
    filtered.sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    setRecordings(filtered)
    setCurrentPage(1)
  }, [allRecordings, searchQuery, statusFilter, typeFilter])

  // Fetch accounts and profiles for replay and test
  useEffect(() => {
    if (replayRecording || testRecording) {
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
    }
  }, [replayRecording, testRecording])

  const handleViewRecording = async (id: string) => {
    try {
      const res = await fetch(`/api/recordings/${id}`)
      const data = await res.json()

      if (res.ok && data) {
        setViewingRecording(data)
        setSelectedId(id)
      } else {
        showToast('Failed to load recording details', 'error')
      }
    } catch (error) {
      console.error('Error loading recording:', error)
      showToast('Failed to load recording details', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) {
      return
    }

    try {
      const res = await fetch(`/api/recordings/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        showToast('Recording deleted successfully', 'success')
        fetchRecordings()
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to delete recording', 'error')
      }
    } catch (error) {
      console.error('Error deleting recording:', error)
      showToast('Failed to delete recording', 'error')
    }
  }

  const handleReplay = async (accountId?: string, profileId?: string) => {
    if (!replayRecording) return

    if (!accountId && !profileId) {
      showToast('Please select an account or profile', 'error')
      return
    }

    try {
      setReplayLoading(true)
      const res = await fetch(`/api/recordings/${replayRecording.id}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: accountId || null,
          profileId: profileId || null,
          options: {
            speedMultiplier: 1.0,
            stopOnError: false,
            retryOnError: true,
            retryCount: 3,
          },
        }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast(`Replay started successfully. Run ID: ${data.runId}`, 'success')
        setReplayRecording(null)
      } else {
        showToast(data.error || 'Failed to start replay', 'error')
      }
    } catch (error) {
      console.error('Error starting replay:', error)
      showToast('Failed to start replay', 'error')
    } finally {
      setReplayLoading(false)
    }
  }

  // Pagination
  const totalPages = Math.ceil(recordings.length / perPage)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const paginatedRecordings = recordings.slice(startIndex, endIndex)

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Action Recordings</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage and replay browser automation recordings
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <a
            href="/recordings/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ➕ New Recording
          </a>
          <button
            onClick={() => setTestRecording(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            🎬 Test Record
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name..."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Account Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All</option>
            <option value="gmail">Gmail</option>
            <option value="coingecko">CoinGecko</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Per Page</label>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : paginatedRecordings.length === 0 ? (
        <div className="mt-8 text-center text-gray-500">No recordings found</div>
      ) : (
        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                      Name
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Account Type
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Duration
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Runs
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Updated
                    </th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedRecordings.map((recording) => (
                    <tr key={recording.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                        <div>
                          <div>{recording.name}</div>
                          {recording.description && (
                            <div className="text-xs text-gray-500">{recording.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {recording.accountType || '-'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {recording.actionCount}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {formatDuration(recording.durationMs)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold ${
                            recording.status === 'published'
                              ? 'bg-green-100 text-green-800'
                              : recording.status === 'archived'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {recording.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {recording.runCount || 0}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(recording.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewRecording(recording.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setReplayRecording(recording)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Replay
                          </button>
                          <button
                            onClick={() => handleDelete(recording.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(endIndex, recordings.length)} of{' '}
                {recordings.length} recordings
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>
                <div className="flex items-center px-3 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Recording Modal */}
      <Modal
        isOpen={viewingRecording !== null}
        onClose={() => {
          setViewingRecording(null)
          setSelectedId(null)
        }}
        title={viewingRecording?.name || 'Recording Details'}
      >
        {viewingRecording && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <p className="mt-1 text-sm text-gray-900">
                {viewingRecording.description || '-'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Account Type</label>
                <p className="mt-1 text-sm text-gray-900">{viewingRecording.accountType || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">URL</label>
                <p className="mt-1 text-sm text-gray-900">{viewingRecording.url || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Actions</label>
                <p className="mt-1 text-sm text-gray-900">{viewingRecording.actionCount}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Duration</label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatDuration(viewingRecording.durationMs)}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Actions</label>
              <div className="max-h-96 overflow-y-auto border rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        Time
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        Description
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        Selector
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {viewingRecording.actions.map((action, idx) => (
                      <tr key={action.id || idx}>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {Math.floor(action.timestamp / 1000)}s
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900">{action.type}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {action.description || '-'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                          {action.selector || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Replay Modal */}
      <Modal
        isOpen={replayRecording !== null}
        onClose={() => setReplayRecording(null)}
        title={`Replay: ${replayRecording?.name || ''}`}
      >
        {replayRecording && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Account
              </label>
              <select
                id="replay-account"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">-- Select Account --</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label} ({account.accountType}) - {account.identifier}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-center text-gray-500 text-sm">OR</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Profile
              </label>
              <select
                id="replay-profile"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">-- Select Profile --</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.profileUid}) - {profile.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setReplayRecording(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const accountSelect = document.getElementById(
                    'replay-account'
                  ) as HTMLSelectElement
                  const profileSelect = document.getElementById(
                    'replay-profile'
                  ) as HTMLSelectElement
                  handleReplay(
                    accountSelect.value || undefined,
                    profileSelect.value || undefined
                  )
                }}
                disabled={replayLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {replayLoading ? 'Starting...' : 'Start Replay'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Test Recording Modal */}
      <Modal
        isOpen={testRecording}
        onClose={() => setTestRecording(false)}
        title="Test Recording"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            This will create a test recording by navigating to a URL and performing some basic actions.
            You need to provide either an account or profile.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Account
            </label>
            <select
              id="test-account"
              className="block w-full rounded-md border-gray-300 text-gray-900 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Profile
            </label>
            <select
              id="test-profile"
              className="block w-full rounded-md border-gray-300 text-gray-900 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="" className="text-gray-900">-- Select Profile --</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id} className="text-gray-900">
                  {profile.name} ({profile.profileUid}) - {profile.status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test URL (optional)
            </label>
            <input
              type="text"
              id="test-url"
              defaultValue="https://www.google.com"
              placeholder="https://www.google.com"
              className="block w-full rounded-md border-gray-300 text-gray-900 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setTestRecording(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const accountSelect = document.getElementById(
                  'test-account'
                ) as HTMLSelectElement
                const profileSelect = document.getElementById(
                  'test-profile'
                ) as HTMLSelectElement
                const urlInput = document.getElementById('test-url') as HTMLInputElement

                const accountId = accountSelect.value || undefined
                const profileId = profileSelect.value || undefined
                const testUrl = urlInput.value || 'https://www.google.com'

                if (!accountId && !profileId) {
                  showToast('Please select an account or profile', 'error')
                  return
                }

                try {
                  setTestLoading(true)
                  const res = await fetch('/api/recordings/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      accountId,
                      profileId,
                      testUrl,
                    }),
                  })

                  const data = await res.json()

                  if (res.ok) {
                    showToast(
                      `Test recording completed! Recording ID: ${data.recordingId}`,
                      'success'
                    )
                    setTestRecording(false)
                    fetchRecordings() // Refresh list
                  } else {
                    const errorData = await res.json()
                    const errorMessage = errorData.error || 'Failed to create test recording'
                    const errorDetails = errorData.details || ''
                    const troubleshooting = errorData.troubleshooting || []
                    
                    // Show detailed error message
                    let fullError = errorMessage
                    if (errorDetails) {
                      fullError += `: ${errorDetails}`
                    }
                    if (troubleshooting.length > 0) {
                      fullError += `\n\n${troubleshooting.join('\n')}`
                    }
                    
                    showToast(fullError, 'error')
                    console.error('[Test Recording] Error details:', errorData)
                  }
                } catch (error) {
                  console.error('Error creating test recording:', error)
                  showToast('Failed to create test recording', 'error')
                } finally {
                  setTestLoading(false)
                }
              }}
              disabled={testLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testLoading ? 'Recording...' : 'Start Test'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

