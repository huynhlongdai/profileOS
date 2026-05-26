'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import { RefreshCw, FileText, AlertTriangle, Info, AlertCircle, Search } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'

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

const typeVariant: Record<string, 'info' | 'warning' | 'error'> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
}

const typeIcon: Record<string, React.ReactNode> = {
  info: <Info size={12} />,
  warning: <AlertTriangle size={12} />,
  error: <AlertCircle size={12} />,
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [filters, setFilters] = useState({ module: '', type: '', accountId: '' })
  const { showToast } = useToastContext()

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 10000)
    return () => clearInterval(interval)
  }, [page, filters])

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() })
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
    } catch {
      showToast('Error loading logs', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
        <div className="h-64 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Logs</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {total} entries &middot; auto-refresh 10s
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { setRefreshing(true); fetchLogs() }} loading={refreshing}>
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Filters */}
      <Card padding={true}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <Input
              value={filters.module}
              onChange={(e) => { setFilters({ ...filters, module: e.target.value }); setPage(1) }}
              placeholder="Filter by module..."
              className="pl-9"
            />
          </div>
          <select
            value={filters.type}
            onChange={(e) => { setFilters({ ...filters, type: e.target.value }); setPage(1) }}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">All Types</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <Input
            value={filters.accountId}
            onChange={(e) => { setFilters({ ...filters, accountId: e.target.value }); setPage(1) }}
            placeholder="Filter by account ID..."
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-2)' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Module</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Message</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Account</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                    No logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:brightness-110 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge>{log.module}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={typeVariant[log.type] || 'default'} dot>
                        {typeIcon[log.type]} {log.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {log.message}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>
                      {log.account ? `${log.account.label}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {page} of {totalPages} &middot; {total} total
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
