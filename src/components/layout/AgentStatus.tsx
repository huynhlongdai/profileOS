'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

interface AgentInfo {
  isOnline: boolean
  lastSeen: string | null
  version: string | null
  providers: string[]
}

export default function AgentStatus() {
  const [agent, setAgent] = useState<AgentInfo | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/agent/status-public')
        if (res.ok) {
          const data = await res.json()
          setAgent(data.agent)
        }
      } catch {
        // Ignore errors
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 15000)
    return () => clearInterval(interval)
  }, [])

  if (!agent) return null

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
      style={{ backgroundColor: 'var(--bg-surface-2)' }}
      title={agent.isOnline
        ? `Agent v${agent.version || '?'} | ${agent.providers.join(', ')}`
        : 'Agent offline'
      }
    >
      {agent.isOnline ? (
        <>
          <Wifi size={14} className="text-emerald-400" />
          <span className="text-emerald-400 font-medium hidden sm:inline">Agent Online</span>
          <span className="text-emerald-400 font-medium sm:hidden">Online</span>
        </>
      ) : (
        <>
          <WifiOff size={14} className="text-red-400" />
          <span className="text-red-400 font-medium hidden sm:inline">Agent Offline</span>
          <span className="text-red-400 font-medium sm:hidden">Offline</span>
        </>
      )}
    </div>
  )
}
