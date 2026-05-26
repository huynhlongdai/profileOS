'use client'

import Link from 'next/link'

interface Account {
  id: string
  label: string
  accountType: string
  lastCare: string | null
  createdAt: string
}

interface Proxy {
  id: string
  label: string
  rawProxy: string
  status: string
}

interface SmartAlertsProps {
  inactiveAccounts: Account[]
  bannedAccounts: { id: string; label: string; accountType: string; status: string }[]
  deadProxies: Proxy[]
}

function timeAgo(dateString: string | null, fallbackDate: string) {
  if (!dateString && !fallbackDate) return 'Unknown'
  const date = new Date(dateString || fallbackDate)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return `${diffDays} days ago`
}

export default function SmartAlerts({ inactiveAccounts, bannedAccounts, deadProxies }: SmartAlertsProps) {
  const hasAlerts = inactiveAccounts.length > 0 || bannedAccounts.length > 0 || deadProxies.length > 0

  if (!hasAlerts) {
    return (
      <div className="bg-white rounded-lg p-6 text-center shadow-sm border border-gray-100 flex flex-col items-center justify-center h-full min-h-[200px]" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--success)' }}>
          <span className="text-xl">✨</span>
        </div>
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>All Good!</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No resources need your attention right now.</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-sm rounded-lg flex flex-col h-full border border-gray-100" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', maxHeight: '600px' }}>
      <div className="p-4 border-b border-gray-100 flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
        <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span className="text-red-500 animate-pulse">🛎️</span> Action Required
        </h2>
      </div>
      
      {/* Thêm overscroll và max-height để internal scroll mượt */}
      <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
        
        {/* Dead Proxies */}
        {deadProxies.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-50 last:border-b-0" style={{ borderColor: 'var(--border-color)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 text-red-500 sticky top-0 bg-white dark:bg-[#1e1e1e] pt-1 z-10" style={{ backgroundColor: 'var(--bg-surface)' }}>Dead / Error Proxies</h3>
            <div className="space-y-2">
              {deadProxies.map(proxy => (
                <div key={proxy.id} className="flex justify-between items-center bg-red-50 p-2 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{proxy.label}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{proxy.rawProxy}</p>
                  </div>
                  {/* Precise Link: Filter status=dead/error or search specific proxy */}
                  <Link href={`/proxies?search=${encodeURIComponent(proxy.rawProxy)}`} className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 ml-2 shrink-0 border border-transparent hover:border-red-300 transition-colors">
                    Fix
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banned Accounts */}
        {bannedAccounts.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-50 last:border-b-0" style={{ borderColor: 'var(--border-color)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 text-orange-500 sticky top-0 bg-white dark:bg-[#1e1e1e] pt-1 z-10" style={{ backgroundColor: 'var(--bg-surface)' }}>Banned Accounts</h3>
            <div className="space-y-2">
              {bannedAccounts.map(account => (
                <div key={account.id} className="flex justify-between items-center bg-orange-50 p-2 rounded" style={{ backgroundColor: 'rgba(249, 115, 22, 0.05)' }}>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{account.label}</p>
                    <p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{account.accountType}</p>
                  </div>
                  {/* Precise Link: exact label search */}
                  <Link href={`/accounts?search=${encodeURIComponent(account.label)}`} className="text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 ml-2 shrink-0 border border-transparent hover:border-orange-300 transition-colors">
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inactive Accounts */}
        {inactiveAccounts.length > 0 && (
          <div className="px-4 py-3 last:border-b-0 pb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 text-yellow-500 sticky top-0 bg-white dark:bg-[#1e1e1e] pt-1 z-10" style={{ backgroundColor: 'var(--bg-surface)' }}>Inactive Accounts ({'>'} 14 days)</h3>
            <div className="space-y-2">
              {inactiveAccounts.map(account => (
                <div key={account.id} className="flex justify-between items-center p-2 rounded border border-gray-100" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0"></span> {account.label}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Last active: {timeAgo(account.lastCare, account.createdAt)}</p>
                  </div>
                  <Link href={`/accounts?search=${encodeURIComponent(account.label)}`} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-1 rounded hover:bg-indigo-100 ml-2 shrink-0" style={{ borderColor: 'rgba(99, 102, 241, 0.2)', backgroundColor: 'rgba(99, 102, 241, 0.05)', color: 'var(--accent)' }}>
                    Action
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
