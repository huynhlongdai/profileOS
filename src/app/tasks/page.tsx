'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import { RefreshCw, ListTodo, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import Card, { StatCard } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

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

const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'error'> = {
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  failed: 'error',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const { showToast } = useToastContext()

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [statusFilter])

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      const res = await fetch(`/api/tasks?${params}`)
      const data = await res.json()
      if (data.success) {
        setTasks(data.tasks || [])
        setStats(data.stats || null)
      } else {
        showToast('Error loading tasks', 'error')
      }
    } catch {
      showToast('Error loading tasks', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt || !completedAt) return '-'
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime()
    if (duration < 1000) return `${duration}ms`
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`
    return `${(duration / 60000).toFixed(1)}m`
  }

  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const processingCount = tasks.filter(t => t.status === 'processing').length
  const completedCount = tasks.filter(t => t.status === 'completed').length
  const failedCount = tasks.filter(t => t.status === 'failed').length

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Tasks</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Auto-refresh 5s
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { setRefreshing(true); fetchTasks() }} loading={refreshing}>
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Queue" value={stats.queueLength} icon={<Clock size={16} />} />
          <StatCard label="Running" value={`${stats.runningCount}/${stats.maxConcurrentTasks}`} icon={<Loader2 size={16} />} variant="warning" />
          <StatCard label="Completed" value={completedCount} icon={<CheckCircle2 size={16} />} variant="success" />
          <StatCard label="Failed" value={failedCount} icon={<XCircle size={16} />} variant={failedCount > 0 ? 'error' : 'default'} />
        </div>
      )}

      {/* Filter */}
      <Card padding={true}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">All</option>
            <option value="pending">Pending ({pendingCount})</option>
            <option value="processing">Processing ({processingCount})</option>
            <option value="completed">Completed ({completedCount})</option>
            <option value="failed">Failed ({failedCount})</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-2)' }}>
                {['ID', 'Type', 'Status', 'Priority', 'Created', 'Duration', 'Error'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                    <ListTodo size={32} className="mx-auto mb-2 opacity-30" />
                    No tasks found
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:brightness-110 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {task.id.substring(0, 12)}...
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="info">{task.type}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={statusVariant[task.status] || 'default'} dot>{task.status}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {task.priority}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(task.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDuration(task.startedAt, task.completedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--color-error)' }}>
                      {task.error || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
