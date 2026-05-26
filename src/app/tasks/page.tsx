'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'

interface Task {
  id: string
  type: 'check' | 'care'
  accountId: string
  createdAt: string
  priority: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  error?: string
}

interface TaskStats {
  queueLength: number
  runningCount: number
  maxConcurrentTasks: number
  isProcessing: boolean
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { showToast } = useToastContext()

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 5000) // Auto-refresh every 5s
    return () => clearInterval(interval)
  }, [statusFilter])

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) {
        params.append('status', statusFilter)
      }

      const res = await fetch(`/api/tasks?${params}`)
      const data = await res.json()
      if (data.success) {
        setTasks(data.tasks || [])
        setStats(data.stats || null)
      } else {
        showToast('Error loading tasks', 'error')
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
      showToast('Error loading tasks', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    }
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          colors[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status}
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
        {type}
      </span>
    )
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt || !completedAt) return '-'
    const start = new Date(startedAt).getTime()
    const end = new Date(completedAt).getTime()
    const duration = end - start
    if (duration < 1000) return `${duration}ms`
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`
    return `${(duration / 60000).toFixed(1)}m`
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  const pendingCount = tasks.filter((t) => t.status === 'pending').length
  const processingCount = tasks.filter((t) => t.status === 'processing').length
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const failedCount = tasks.filter((t) => t.status === 'failed').length

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
        <button
          onClick={fetchTasks}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Queue Length</div>
            <div className="text-2xl font-bold text-gray-900">{stats.queueLength}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Running</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.runningCount} / {stats.maxConcurrentTasks}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Failed</div>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex gap-4 items-center">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="pending">Pending ({pendingCount})</option>
            <option value="processing">Processing ({processingCount})</option>
            <option value="completed">Completed ({completedCount})</option>
            <option value="failed">Failed ({failedCount})</option>
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Account ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Started
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Error
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                  No tasks found
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {task.id.substring(0, 20)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getTypeBadge(task.type)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {task.accountId.substring(0, 20)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {task.priority}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(task.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(task.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(task.startedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(task.completedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDuration(task.startedAt, task.completedAt)}
                  </td>
                  <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                    {task.error || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

