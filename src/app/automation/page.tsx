'use client'

import { useEffect, useState } from 'react'
import { Play, Square, Trash2, Eye, Copy } from 'lucide-react'
import { RecorderControls } from '@/components/automation/RecorderControls'
import { VariableDefinitionModal } from '@/components/automation/VariableDefinitionModal'
import type { RecordedAction, TemplateVariable } from '@/types/automation'

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

    // Variable Definition Modal state
    const [showVariableModal, setShowVariableModal] = useState(false)
    const [selectedRecordingForConversion, setSelectedRecordingForConversion] = useState<Recording | null>(null)
    const [recordingActions, setRecordingActions] = useState<RecordedAction[]>([])

    useEffect(() => {
        fetchRecordings()
        fetchProfiles()
    }, [])

    const fetchRecordings = async () => {
        try {
            const res = await fetch('/api/automation/recordings')
            const data = await res.json()
            if (data.success) {
                setRecordings(data.recordings || [])
            }
        } catch (error) {
            console.error('Error fetching recordings:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchProfiles = async () => {
        try {
            const res = await fetch('/api/profiles')
            const data = await res.json()
            if (data.success) {
                const runningProfiles = data.profiles.filter((p: Profile) => p.status === 'running')
                setProfiles(runningProfiles)
                if (runningProfiles.length > 0 && !selectedProfileId) {
                    setSelectedProfileId(runningProfiles[0].id)
                }
            }
        } catch (error) {
            console.error('Error fetching profiles:', error)
        }
    }

    const handleRecordingStart = (recordingId: string) => {
        setActiveRecordingId(recordingId)
        // Refresh recordings list
        setTimeout(fetchRecordings, 1000)
    }

    const handleRecordingStop = () => {
        setActiveRecordingId(null)
        // Refresh recordings list
        fetchRecordings()
    }

    const deleteRecording = async (id: string) => {
        if (!confirm('Are you sure you want to delete this recording?')) return

        try {
            const res = await fetch(`/api/automation/recordings/${id}`, {
                method: 'DELETE',
            })
            const data = await res.json()
            if (data.success) {
                fetchRecordings()
            }
        } catch (error) {
            console.error('Error deleting recording:', error)
        }
    }

    const viewRecording = async (id: string) => {
        try {
            const res = await fetch(`/api/automation/recordings/${id}`)
            const data = await res.json()
            if (data.success) {
                const actions = JSON.parse(data.recording.actionsJson)
                console.log('Recording actions:', actions)
                alert(`Recording has ${actions.length} actions. Check console for details.`)
            }
        } catch (error) {
            console.error('Error viewing recording:', error)
        }
    }

    const convertToTemplate = async (id: string) => {
        // Fetch recording with actions
        try {
            const res = await fetch(`/api/automation/recordings/${id}`)
            const data = await res.json()
            if (data.success) {
                const actions = JSON.parse(data.recording.actionsJson)
                setRecordingActions(actions)
                setSelectedRecordingForConversion(data.recording)
                setShowVariableModal(true)
            }
        } catch (error) {
            console.error('Error fetching recording:', error)
            alert('Failed to load recording')
        }
    }

    const handleVariableModalConfirm = async (variables: TemplateVariable[]) => {
        if (!selectedRecordingForConversion) return

        // Get template info from user
        const name = prompt('Enter template name:')
        if (!name) return

        const description = prompt('Enter description (optional):')
        const category = prompt(
            'Enter category (social-media, e-commerce, data-entry, testing, other):',
            'other'
        )

        if (!category) return

        try {
            const res = await fetch(
                `/api/automation/recordings/${selectedRecordingForConversion.id}/convert`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        description,
                        category,
                        variables,
                    }),
                }
            )

            const data = await res.json()
            if (data.success) {
                alert('✅ Template created successfully!')
                // Optionally navigate to templates page
                window.location.href = '/automation/templates'
            } else {
                alert('❌ Failed to create template: ' + data.error)
            }
        } catch (error) {
            console.error('Error converting to template:', error)
            alert('❌ Failed to create template')
        }
    }

    return (
        <div className="container mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Automation</h1>
                <p className="text-gray-600">Record and replay browser actions</p>
            </div>

            {/* Recorder Section */}
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Action Recorder</h2>

                {profiles.length === 0 ? (
                    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 text-red-600 text-2xl">⚠️</div>
                            <div className="flex-1">
                                <p className="font-bold text-red-900 text-lg mb-2">
                                    No Running Profiles Found
                                </p>
                                <p className="text-red-800 mb-3">
                                    You need to start a browser profile before you can begin recording
                                    actions.
                                </p>
                                <div className="bg-white rounded-lg p-3 mb-3 border border-red-200">
                                    <p className="font-semibold text-red-900 mb-2">
                                        Steps to start recording:
                                    </p>
                                    <ol className="list-decimal list-inside space-y-1 text-sm text-red-800">
                                        <li>Go to the Profiles page</li>
                                        <li>Select a profile you want to use</li>
                                        <li>Click the "Start" button to launch the browser</li>
                                        <li>Return to this page to start recording</li>
                                    </ol>
                                </div>
                                <a
                                    href="/profiles"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                                >
                                    <span>→</span>
                                    Go to Profiles Page
                                </a>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Profile
                            </label>
                            <select
                                value={selectedProfileId}
                                onChange={(e) => setSelectedProfileId(e.target.value)}
                                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {profiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>
                                        {profile.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <RecorderControls
                            profileId={selectedProfileId}
                            onRecordingStart={handleRecordingStart}
                            onRecordingStop={handleRecordingStop}
                        />

                        {activeRecordingId && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800">
                                <p className="font-medium">Recording in progress</p>
                                <p className="text-sm mt-1">All your actions in the browser are being captured.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Recordings List */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Recordings</h2>

                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : recordings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No recordings yet</p>
                        <p className="text-sm mt-1">Start recording to create your first automation</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                                    <th className="text-center py-3 px-4 font-medium text-gray-700">Actions</th>
                                    <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
                                    <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                                    <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recordings.map((recording) => (
                                    <tr key={recording.id} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4 font-medium">{recording.name}</td>
                                        <td className="py-3 px-4 text-gray-600 text-sm">
                                            {recording.description || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                                                {recording.actionCount}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span
                                                className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${recording.status === 'published'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                    }`}
                                            >
                                                {recording.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {new Date(recording.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => convertToTemplate(recording.id)}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                    title="Convert to template"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => viewRecording(recording.id)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="View actions"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteRecording(recording.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            {/* Variable Definition Modal */}
            <VariableDefinitionModal
                isOpen={showVariableModal}
                onClose={() => setShowVariableModal(false)}
                actions={recordingActions}
                onConfirm={handleVariableModalConfirm}
            />
        </div>
    )
}
