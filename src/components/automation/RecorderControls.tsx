'use client'

import { useState } from 'react'
import { Play, Square, Loader2 } from 'lucide-react'

interface RecorderControlsProps {
    profileId: string
    onRecordingStart?: (recordingId: string) => void
    onRecordingStop?: () => void
}

export function RecorderControls({
    profileId,
    onRecordingStart,
    onRecordingStop,
}: RecorderControlsProps) {
    const [isRecording, setIsRecording] = useState(false)
    const [recordingId, setRecordingId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [actionCount, setActionCount] = useState(0)

    const startRecording = async () => {
        const name = prompt('Enter recording name:')
        if (!name) return

        const description = prompt('Enter description (optional):')

        setIsLoading(true)
        try {
            const res = await fetch('/api/automation/recordings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId, name, description }),
            })

            const data = await res.json()
            if (data.success) {
                setRecordingId(data.recording.id)
                setIsRecording(true)
                setActionCount(0)
                onRecordingStart?.(data.recording.id)

                // Show success message
                alert(
                    '✅ Recording started!\n\n' +
                    'All your actions in the browser will be captured.\n' +
                    'Look for the red recording indicator in the top-right corner of the browser.'
                )
            } else {
                // Show detailed error message from backend
                alert(
                    '❌ Failed to start recording\n\n' +
                    'Error: ' +
                    data.error +
                    '\n\n' +
                    'Please check:\n' +
                    '• Is the profile running?\n' +
                    '• Is the browser window open?\n' +
                    '• Try restarting the profile if needed.'
                )
            }
        } catch (error) {
            console.error('Error starting recording:', error)
            alert(
                '❌ Failed to start recording\n\n' +
                'Network error or server is not responding.\n\n' +
                'Please check the console for details.'
            )
        } finally {
            setIsLoading(false)
        }
    }

    const stopRecording = async () => {
        if (!recordingId) return

        setIsLoading(true)
        try {
            const res = await fetch(`/api/automation/recordings/${recordingId}/stop`, {
                method: 'POST',
            })

            const data = await res.json()
            if (data.success) {
                setIsRecording(false)
                setRecordingId(null)
                setActionCount(0)
                onRecordingStop?.()

                alert(`Recording stopped! Captured ${data.recording.actionCount} actions.`)
            } else {
                alert('Failed to stop recording: ' + data.error)
            }
        } catch (error) {
            console.error('Error stopping recording:', error)
            alert('Failed to stop recording')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex items-center gap-2">
            {!isRecording ? (
                <button
                    onClick={startRecording}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Play className="w-4 h-4 fill-current" />
                    )}
                    <span className="font-medium">Start Recording</span>
                </button>
            ) : (
                <div className="flex items-center gap-3">
                    <button
                        onClick={stopRecording}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Square className="w-4 h-4 fill-current" />
                        )}
                        <span className="font-medium">Stop Recording</span>
                    </button>

                    <div className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-800 rounded-lg">
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                        <span className="text-sm font-medium">Recording</span>
                        {actionCount > 0 && (
                            <span className="text-xs bg-red-200 px-2 py-0.5 rounded">
                                {actionCount} actions
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
