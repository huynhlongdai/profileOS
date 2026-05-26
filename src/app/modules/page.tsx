'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'

interface Module {
  name: string
  label: string
  version: string
  description: string
  enabled: boolean
  configJson?: string | null
}

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToastContext()

  useEffect(() => {
    fetchModules()
    const interval = setInterval(fetchModules, 60000) // Auto-refresh every 60s
    return () => clearInterval(interval)
  }, [])

  const fetchModules = async () => {
    try {
      const res = await fetch('/api/modules')
      const data = await res.json()
      if (data.success) {
        setModules(data.modules)
      } else {
        showToast(data.error || 'Error loading modules', 'error')
      }
    } catch (error) {
      console.error('Error fetching modules:', error)
      showToast('Error loading modules', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleModule = async (module: Module) => {
    const newEnabled = !module.enabled
    // Optimistic update
    setModules((prev) =>
      prev.map((m) =>
        m.name === module.name ? { ...m, enabled: newEnabled } : m
      )
    )

    try {
      const res = await fetch(`/api/modules/${module.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      })

      const data = await res.json()
      if (data.success) {
        showToast(
          `Module ${module.label} ${newEnabled ? 'enabled' : 'disabled'}`,
          'success'
        )
        // Update with server response
        setModules((prev) =>
          prev.map((m) =>
            m.name === module.name ? { ...m, enabled: data.module.enabled } : m
          )
        )
      } else {
        // Revert on error
        setModules((prev) =>
          prev.map((m) =>
            m.name === module.name ? { ...m, enabled: module.enabled } : m
          )
        )
        showToast(data.error || 'Error updating module', 'error')
      }
    } catch (error) {
      // Revert on error
      setModules((prev) =>
        prev.map((m) =>
          m.name === module.name ? { ...m, enabled: module.enabled } : m
        )
      )
      console.error('Error toggling module:', error)
      showToast('Error updating module', 'error')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Modules</h1>
        <button
          onClick={fetchModules}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Module
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mô tả
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Version
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Enabled
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {modules.map((module) => (
              <tr key={module.name} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {module.label}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {module.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {module.version}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => toggleModule(module)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      module.enabled
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                    }`}
                  >
                    {module.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
              </tr>
            ))}

            {modules.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                  Chưa có module nào được khai báo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

