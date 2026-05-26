'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react'

interface Execution {
    id: string
    profileId: string
    status: string
    error: string | null
    startedAt: string | null
    completedAt: string | null
    duration: number | null
    createdAt: string
    template: {
        id: string
        name: string
        category: string
    } | null
}

export default function ExecutionsPage() {
    const [allExecutions, setAllExecutions] = useState<Execution[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>('all')

    useEffect(() => {
        fetchExecutions()
        const interval = setInterval(fetchExecutions, 5000) // Auto-refresh every 5s
        return () => clearInterval(interval)
    }, [])

    const fetchExecutions = async () => {
        try {
            const res = await fetch('/api/automation/executions')
            const data = await res.json()
            if (data.success) {
                setAllExecutions(data.executions || [])
            }
        } catch (error) {
            console.error('Error fetching executions:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredExecutions = allExecutions.filter(
        (exe) => statusFilter === 'all' || exe.status === statusFilter
    )

    const counts = {
        all: allExecutions.length,
        pending: allExecutions.filter((e) => e.status === 'pending').length,
        running: allExecutions.filter((e) => e.status === 'running').length,
        completed: allExecutions.filter((e) => e.status === 'completed').length,
        failed: allExecutions.filter((e) => e.status === 'failed').length,
        cancelled: allExecutions.filter((e) => e.status === 'cancelled').length,
    }

    const viewExecution = async (id: string) => {
        try {
            const res = await fetch(`/api/automation/executions/${id}`)
            const data = await res.json()
            if (data.success) {
                const result = data.execution.resultJson
                    ? JSON.parse(data.execution.resultJson)
                    : null
                const logs = data.execution.logsJson ? JSON.parse(data.execution.logsJson) : []
                console.log('Execution details:', { result, logs })
                alert('Execution details logged to console')
            }
        } catch (error) {
            console.error('Error viewing execution:', error)
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-600" />
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-600" />
            case 'running':
                return <Clock className="w-5 h-5 text-blue-600 animate-spin" />
            default:
                return <Clock className="w-5 h-5 text-gray-600" />
        }
    }

    const getStatusBadge = (status: string) => {
        const styles = {
            pending: 'bg-gray-100 text-gray-800',
            running: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            failed: 'bg-red-100 text-red-800',
            cancelled: 'bg-orange-100 text-orange-800',
        }
        return styles[status as keyof typeof styles] || styles.pending
    }

    return (
        <div className="container mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Automation Executions</h1>
                <p className="text-gray-600">Track your automation runs</p>
            </div>

            {/* Status Filter */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
                <div className="flex gap-2 flex-wrap">
                    {['all', 'pending', 'running', 'completed', 'failed', 'cancelled'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize flex items-center gap-2 ${statusFilter === status
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {status}
                            <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusFilter === status
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-600'
                                    }`}
                            >
                                {counts[status as keyof typeof counts]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Executions Table */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Execution History</h2>

                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : filteredExecutions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No executions found</p>
                        <p className="text-sm mt-1">Run a template to see execution history</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Template</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Started</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Duration</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Error</th>
                                    <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExecutions.map((execution) => (
                                    <tr key={execution.id} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(execution.status)}
                                                <span
                                                    className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${getStatusBadge(
                                                        execution.status
                                                    )}`}
                                                >
                                                    {execution.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div>
                                                <div className="font-medium">
                                                    {execution.template?.name || 'Unknown'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {execution.template?.category}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {execution.startedAt
                                                ? new Date(execution.startedAt).toLocaleString()
                                                : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {execution.duration
                                                ? `${(execution.duration / 1000).toFixed(1)}s`
                                                : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-red-600">
                                            {execution.error ? (
                                                <span className="truncate max-w-xs block" title={execution.error}>
                                                    {execution.error}
                                                </span>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => viewExecution(execution.id)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="View details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
