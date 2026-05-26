'use client'

import React, { useState, useCallback } from 'react'
import LiveViewer from './LiveViewer'
import { X, Minus, Square } from 'lucide-react'

interface LiveViewPanelProps {
    profileId: string
    profileName: string
    debuggerPort?: number | null
    onClose: () => void
}

/**
 * Phase 4: Standalone floating panel for Live View.
 * Can be opened for multiple profiles simultaneously from the Profiles page.
 */
export default function LiveViewPanel({ profileId, profileName, debuggerPort, onClose }: LiveViewPanelProps) {
    const [minimized, setMinimized] = useState(false)

    return (
        <div
            className="flex flex-col bg-gray-950 border border-gray-700 rounded-lg overflow-hidden shadow-2xl"
            style={{ width: '100%', height: '100%' }}
        >
            {/* Panel title bar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0 select-none">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-gray-300 truncate">
                        🖥 {profileName}
                    </span>
                    {debuggerPort && (
                        <span className="text-[10px] text-gray-500 shrink-0">:{debuggerPort}</span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setMinimized(m => !m)}
                        title={minimized ? 'Expand' : 'Minimize'}
                        className="p-0.5 text-gray-500 hover:text-yellow-400 hover:bg-gray-800 rounded transition-colors"
                    >
                        <Minus className="w-3 h-3" />
                    </button>
                    <button
                        onClick={onClose}
                        title="Close"
                        className="p-0.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Live view content */}
            {!minimized && (
                <div className="flex-1 min-h-0">
                    <LiveViewer profileId={profileId} debuggerPort={debuggerPort} />
                </div>
            )}

            {minimized && (
                <div
                    className="flex items-center justify-center py-2 cursor-pointer text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    onClick={() => setMinimized(false)}
                >
                    Click to expand
                </div>
            )}
        </div>
    )
}
