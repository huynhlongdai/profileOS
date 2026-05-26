'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import { RefreshCw, Layers, Power } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

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
  const [refreshing, setRefreshing] = useState(false)
  const { showToast } = useToastContext()

  useEffect(() => {
    fetchModules()
    const interval = setInterval(fetchModules, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchModules = async () => {
    try {
      const res = await fetch('/api/modules')
      const data = await res.json()
      if (data.success) setModules(data.modules)
      else showToast(data.error || 'Error loading modules', 'error')
    } catch {
      showToast('Error loading modules', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const toggleModule = async (module: Module) => {
    const newEnabled = !module.enabled
    setModules(prev => prev.map(m => m.name === module.name ? { ...m, enabled: newEnabled } : m))

    try {
      const res = await fetch(`/api/modules/${module.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`${module.label} ${newEnabled ? 'enabled' : 'disabled'}`, 'success')
        setModules(prev => prev.map(m => m.name === module.name ? { ...m, enabled: data.module.enabled } : m))
      } else {
        setModules(prev => prev.map(m => m.name === module.name ? { ...m, enabled: module.enabled } : m))
        showToast(data.error || 'Error updating module', 'error')
      }
    } catch {
      setModules(prev => prev.map(m => m.name === module.name ? { ...m, enabled: module.enabled } : m))
      showToast('Error updating module', 'error')
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Modules</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {modules.length} modules &middot; {modules.filter(m => m.enabled).length} enabled
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { setRefreshing(true); fetchModules() }} loading={refreshing}>
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modules.map((module) => (
          <Card key={module.name}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: module.enabled ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-surface-2)' }}
                >
                  <Layers size={18} style={{ color: module.enabled ? 'var(--accent)' : 'var(--text-muted)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{module.label}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>v{module.version}</p>
                </div>
              </div>
              <button
                onClick={() => toggleModule(module)}
                className={`relative w-11 h-6 rounded-full transition-colors ${module.enabled ? 'bg-indigo-600' : ''}`}
                style={!module.enabled ? { backgroundColor: 'var(--bg-surface-2)' } : undefined}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    module.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {module.description}
            </p>
            <div className="mt-3">
              <Badge variant={module.enabled ? 'success' : 'muted'} dot>
                {module.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {modules.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <Layers size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No modules found</p>
        </div>
      )}
    </div>
  )
}
