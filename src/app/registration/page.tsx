'use client'

import { useState, useEffect } from 'react'
import { Plus, RefreshCw, Play, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useToastContext } from '@/components/ToastProvider'
import RegistrationForm from '@/components/RegistrationForm'
import TaskMonitor from '@/components/TaskMonitor'

interface Task {
  id: string
  status: 'pending' | 'running' | 'done' | 'failed'
  progress: string
  platform: string
  success?: number
  errors?: string[]
}

interface Platform {
  name: string
  display_name: string
}

export default function RegistrationPage() {
  const { showToast } = useToastContext()
  const [tasks, setTasks] = useState<Task[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/registration/tasks')
      const data = await res.json()
      if (data.success) {
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Failed to fetch tasks', error)
    }
  }

  const fetchPlatforms = async () => {
    try {
      const res = await fetch('/api/registration/platforms')
      const data = await res.json()
      if (data.success) {
        setPlatforms(data.platforms || [])
      }
    } catch (error) {
      console.error('Failed to fetch platforms', error)
    }
  }

  const syncAccounts = async () => {
    try {
      showToast('Account synchronization started...', 'info')
      const res = await fetch('/api/registration/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast(`Sync complete! Imported ${data.success} new accounts, skipped ${data.skipped} duplicates.`, 'success')
      } else {
        showToast(`Sync failed: ${data.error}`, 'error')
      }
    } catch (error) {
      showToast('Failed to sync accounts', 'error')
    }
  }

  useEffect(() => {
    Promise.all([fetchTasks(), fetchPlatforms()]).finally(() => setLoading(false))
    
    // Poll for task updates
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
      case 'done': return <CheckCircle className="w-4 h-4 text-emerald-400" />
      case 'failed': return <XCircle className="w-4 h-4 text-rose-400" />
      default: return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Auto Registration</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Automated multi-platform account creation</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncAccounts}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
            style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw className="w-4 h-4" />
            Sync to GPMTool
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-4 bg-surface-2 border-bottom flex justify-between items-center">
              <h2 className="font-semibold px-4">Active Tasks</h2>
              <button onClick={fetchTasks} className="p-1 hover:bg-white/5 rounded">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2/50 text-gray-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-medium">Task ID</th>
                    <th className="px-6 py-3 font-medium">Platform</th>
                    <th className="px-6 py-3 font-medium">Progress</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Result</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                        No registration tasks found
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr 
                        key={task.id} 
                        className={`hover:bg-white/5 transition-colors cursor-pointer ${activeTaskId === task.id ? 'bg-white/5' : ''}`}
                        onClick={() => setActiveTaskId(task.id)}
                      >
                        <td className="px-6 py-4 font-mono text-[11px]">{task.id}</td>
                        <td className="px-6 py-4 capitalize">{task.platform}</td>
                        <td className="px-6 py-4">{task.progress}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(task.status)}
                            <span className="capitalize">{task.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {task.status === 'done' ? (
                            <span className="text-emerald-400 font-medium">+{task.success || 0} OK</span>
                          ) : task.status === 'failed' ? (
                            <span className="text-rose-400 font-medium">FAIL</span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            className="text-indigo-400 hover:text-indigo-300 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveTaskId(task.id)
                            }}
                          >
                            Logs
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="font-semibold mb-4 text-gray-400 flex items-center gap-2">
              <Play className="w-4 h-4" />
              Live Monitor
            </h2>
            {activeTaskId ? (
              <TaskMonitor taskId={activeTaskId} />
            ) : (
              <div className="h-[400px] border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-gray-500 gap-2">
                <p>Select a task to monitor</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <RegistrationForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        platforms={platforms}
        onTaskCreated={(taskId) => {
          setIsFormOpen(false)
          setActiveTaskId(taskId)
          fetchTasks()
        }}
      />
    </div>
  )
}
