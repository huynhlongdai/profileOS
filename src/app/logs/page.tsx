'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'

interface Log {
  id: string
  module: string
  type: string
  message: string
  metaJson: string | null
  createdAt: string
  account: {
    id: string
    label: string
    identifier: string
  } | null
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [filters, setFilters] = useState({
    module: '',
    type: '',
    accountId: '',
  })
  const { showToast } = useToastContext()

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 10000) // Auto-refresh every 10s
    return () => clearInterval(interval)
  }, [page, filters])

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      if (filters.module) params.append('module', filters.module)
      if (filters.type) params.append('type', filters.type)
      if (filters.accountId) params.append('accountId', filters.accountId)

      const res = await fetch(`/api/logs?${params}`)
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs)
        setTotal(data.total || 0)
      } else {
        showToast('Error loading logs', 'error')
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
      showToast('Error loading logs', 'error')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    }
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          colors[type] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {type}
      </span>
    )
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Logs</h1>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Module
            </label>
            <input
              type="text"
              value={filters.module}
              onChange={(e) => {
                setFilters({ ...filters, module: e.target.value })
                setPage(1)
              }}
              placeholder="Filter by module"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters({ ...filters, type: e.target.value })
                setPage(1)
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account ID
            </label>
            <input
              type="text"
              value={filters.accountId}
              onChange={(e) => {
                setFilters({ ...filters, accountId: e.target.value })
                setPage(1)
              }}
              placeholder="Filter by account ID"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Pagination Info */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {logs.length} of {total} logs (Page {page} of {totalPages})
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Module
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Message
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Account
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.module}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getTypeBadge(log.type)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {log.message}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.account ? `${log.account.label} (${log.account.identifier})` : '-'}
                </td>
              </tr>
            ))}
            </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center items-center space-x-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

