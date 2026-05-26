'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal, ScrollText } from 'lucide-react'

interface TaskMonitorProps {
  taskId: string
}

export default function TaskMonitor({ taskId }: TaskMonitorProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLogs([])
    setStatus(null)
    
    const eventSource = new EventSource(`/api/registration/tasks/${taskId}/logs`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.line) {
          setLogs((prev) => [...prev, data.line])
        }
        
        if (data.done) {
          setStatus(data.status)
          eventSource.close()
        }
      } catch (err) {
        console.error('Error parsing SSE data', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [taskId])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="flex flex-col h-[400px] bg-[#0c0c0d] border border-border rounded-lg overflow-hidden font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-border">
        <div className="flex items-center gap-2 text-gray-400">
          <Terminal className="w-3 h-3" />
          <span>Task: {taskId}</span>
        </div>
        <div className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
          status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
          status === 'failed' ? 'bg-rose-500/20 text-rose-400' :
          'bg-blue-500/20 text-blue-400 animate-pulse'
        }`}>
          {status || 'Running'}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2 opacity-50">
            <ScrollText className="w-5 h-5" />
            <p>Waiting for logs...</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.map((log, idx) => {
              const isError = log.includes('[FAIL]') || log.includes('[ERROR]')
              const isOk = log.includes('[OK]')
              
              return (
                <div key={idx} className={
                  isError ? 'text-rose-400' : 
                  isOk ? 'text-emerald-400' : 
                  'text-gray-300'
                }>
                  {log}
                </div>
              )
            })}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
