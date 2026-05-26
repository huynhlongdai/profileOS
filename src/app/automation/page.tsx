'use client'

import { useEffect, useState } from 'react'
import { Play, Trash2, Eye, Copy, Zap, AlertTriangle } from 'lucide-react'
import { RecorderControls } from '@/components/automation/RecorderControls'
import { VariableDefinitionModal } from '@/components/automation/VariableDefinitionModal'
import type { RecordedAction, TemplateVariable } from '@/types/automation'
import Card, { CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

interface Recording {
  id: string
  name: string
  description: string | null
  actionCount: number
  status: string
  createdAt: string
  updatedAt: string
}

interface Profile {
  id: string
  name: string
  status: string
}

export default function AutomationPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null)
  const [showVariableModal, setShowVariableModal] = useState(false)
  const [selectedRecordingForConversion, setSelectedRecordingForConversion] = useState<Recording | null>(null)
  const [recordingActions, setRecordingActions] = useState<RecordedAction[]>([])

  useEffect(() => { fetchRecordings(); fetchProfiles() }, [])

  const fetchRecordings = async () => {
    try {
      const res = await fetch('/api/automation/recordings')
      const data = await res.json()
      if (data.success) setRecordings(data.recordings || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/profiles')
      const data = await res.json()
      if (data.success) {
        const running = data.profiles.filter((p: Profile) => p.status === 'running')
        setProfiles(running)
        if (running.length > 0 && !selectedProfileId) setSelectedProfileId(running[0].id)
      }
    } catch { /* ignore */ }
  }

  const handleRecordingStart = (recordingId: string) => {
    setActiveRecordingId(recordingId)
    setTimeout(fetchRecordings, 1000)
  }

  const handleRecordingStop = () => { setActiveRecordingId(null); fetchRecordings() }

  const deleteRecording = async (id: string) => {
    if (!confirm('Delete this recording?')) return
    try {
      const res = await fetch(`/api/automation/recordings/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) fetchRecordings()
    } catch { /* ignore */ }
  }

  const viewRecording = async (id: string) => {
    try {
      const res = await fetch(`/api/automation/recordings/${id}`)
      const data = await res.json()
      if (data.success) {
        const actions = JSON.parse(data.recording.actionsJson)
        alert(`Recording has ${actions.length} actions. Check console for details.`)
      }
    } catch { /* ignore */ }
  }

  const convertToTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/automation/recordings/${id}`)
      const data = await res.json()
      if (data.success) {
        setRecordingActions(JSON.parse(data.recording.actionsJson))
        setSelectedRecordingForConversion(data.recording)
        setShowVariableModal(true)
      }
    } catch { alert('Failed to load recording') }
  }

  const handleVariableModalConfirm = async (variables: TemplateVariable[]) => {
    if (!selectedRecordingForConversion) return
    const name = prompt('Enter template name:')
    if (!name) return
    const description = prompt('Enter description (optional):')
    const category = prompt('Enter category (social-media, e-commerce, data-entry, testing, other):', 'other')
    if (!category) return

    try {
      const res = await fetch(`/api/automation/recordings/${selectedRecordingForConversion.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, category, variables }),
      })
      const data = await res.json()
      if (data.success) window.location.href = '/automation/templates'
      else alert('Failed: ' + data.error)
    } catch { alert('Failed to create template') }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Automation</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Record and replay browser actions</p>
      </div>

      {/* Recorder */}
      <Card>
        <CardHeader title="Action Recorder" description="Select a running profile to record" />
        {profiles.length === 0 ? (
          <div className="rounded-lg border p-4" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No Running Profiles</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Start a browser profile before recording.</p>
                <a href="/profiles" className="inline-block mt-3">
                  <Button size="sm">Go to Profiles</Button>
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Select Profile</label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full max-w-md rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <RecorderControls profileId={selectedProfileId} onRecordingStart={handleRecordingStart} onRecordingStop={handleRecordingStop} />
            {activeRecordingId && (
              <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(99, 102, 241, 0.3)', backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Recording in progress</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>All browser actions are being captured.</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Recordings List */}
      <Card padding={false}>
        <div className="p-4 sm:p-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recordings</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{recordings.length} recordings</p>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : recordings.length === 0 ? (
          <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>
            <Zap size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No recordings yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-surface-2)' }}>
                  {['Name', 'Description', 'Actions', 'Status', 'Created', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                {recordings.map((r) => (
                  <tr key={r.id} className="hover:brightness-110 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-4 py-3 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.description || '-'}</td>
                    <td className="px-4 py-3"><Badge variant="info">{r.actionCount}</Badge></td>
                    <td className="px-4 py-3">
                      <Badge variant={r.status === 'published' ? 'success' : 'default'} dot>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => convertToTemplate(r.id)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" style={{ color: 'var(--color-success)' }} title="Convert to template">
                          <Copy size={14} />
                        </button>
                        <button onClick={() => viewRecording(r.id)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" style={{ color: 'var(--accent)' }} title="View">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => deleteRecording(r.id)} className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors text-red-400" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <VariableDefinitionModal isOpen={showVariableModal} onClose={() => setShowVariableModal(false)} actions={recordingActions} onConfirm={handleVariableModalConfirm} />
    </div>
  )
}
