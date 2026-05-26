'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal, ChevronUp, ChevronDown, Trash2, ScrollText, Play, X } from 'lucide-react'

interface LogEntry {
  id: string
  module: string
  type: 'info' | 'warning' | 'error'
  message: string
  createdAt: string
}

export default function LogConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const eventSource = new EventSource('/api/logs/stream')

    eventSource.onopen = () => setIsConnected(true)
    eventSource.onerror = () => setIsConnected(false)

    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data)
        setLogs((prev) => {
          const next = [...prev, log]
          return next.slice(-100) // Keep last 100 logs
        })
      } catch (err) {
        console.error('Failed to parse log', err)
      }
    }

    return () => eventSource.close()
  }, [])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll, isExpanded])

  const clearLogs = () => setLogs([])

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-[100] transition-all duration-300 ease-in-out border-t shadow-2xl ${
        isExpanded ? 'h-64' : 'h-10'
      }`}
      style={{ 
        backgroundColor: 'var(--bg-surface)', 
        borderColor: 'var(--border-color)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Header / Toolbar */}
      <div 
        className="flex items-center justify-between px-4 h-10 cursor-pointer select-none border-b border-border/50"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ backgroundColor: 'var(--bg-surface-2)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className={`w-4 h-4 ${isConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-xs font-bold tracking-tight uppercase">System Logs</span>
          </div>
          {!isExpanded && logs.length > 0 && (
            <span className="text-[10px] text-gray-500 font-mono truncate max-w-md animate-fade-in">
              [{new Date(logs[logs.length-1].createdAt).toLocaleTimeString()}] [{logs[logs.length-1].module}] {logs[logs.length-1].message}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isExpanded && (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1.5 rounded transition-colors ${autoScroll ? 'text-indigo-400 bg-indigo-400/10' : 'text-gray-500 hover:bg-white/5'}`}
                title="Toggle Auto-scroll"
              >
                <ScrollText className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={clearLogs}
                className="p-1.5 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                title="Clear Logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button className="text-gray-500 hover:text-white transition-colors">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Log List */}
      {isExpanded && (
        <div 
          ref={scrollRef}
          className="overflow-y-auto h-[calc(100%-40px)] p-3 font-mono text-[11px] leading-relaxed custom-scrollbar bg-[#0c0c0d]"
        >
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50 gap-2">
              <Play className="w-5 h-5" />
              <p>Waiting for system events...</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {logs.map((log, i) => (
                <div key={log.id || i} className="flex gap-2 group hover:bg-white/5 transition-colors pr-2">
                  <span className="text-gray-600 shrink-0 select-none">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour12: false })}
                  </span>
                  <span className={`shrink-0 font-bold uppercase text-[9px] w-12 text-center rounded px-1 min-w-[50px] ${
                    log.type === 'error' ? 'bg-rose-500/10 text-rose-400' :
                    log.type === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {log.type}
                  </span>
                  <span className="text-gray-500 shrink-0 font-bold">[{log.module}]</span>
                  <span className={`break-all ${
                    log.type === 'error' ? 'text-rose-300' :
                    log.type === 'warning' ? 'text-amber-200' :
                    'text-gray-300'
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
