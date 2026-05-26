'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import ActivityChart from '@/components/dashboard/ActivityChart'
import AccountTypesChart from '@/components/dashboard/AccountTypesChart'
import SmartAlerts from '@/components/dashboard/SmartAlerts'

interface Stats {
  accounts: {
    total: number
    active: number
    logged_out: number
    error: number
    banned: number
    proxy_error: number
    byType: Record<string, number>
  }
  proxies: {
    total: number
    active: number
    dead: number
    checking: number
    error: number
  }
  profiles: {
    total: number
    running: number
    idle: number
    starting: number
    stopping: number
    error: number
    byBrowser: Record<string, number>
  }
  executions: {
    total: number
    pending: number
    running: number
    completed: number
    failed: number
    cancelled: number
  }
  logs24h: number
  timeline: { date: string, count: number }[]
  inactiveAccounts: any[]
  bannedAccounts: any[]
  deadProxies: any[]
}

type TabKey = 'accounts' | 'profiles' | 'proxies' | 'executions'

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('accounts')
  const { showToast } = useToastContext()

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      if (data.success) {
        setStats(data.stats)
      } else {
        showToast('Error loading stats', 'error')
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      showToast('Error loading stats', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>Loading insight data...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Error loading dashboard data</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  // Helper for Tabs
  const renderTabContent = () => {
    switch (activeTab) {
      case 'accounts':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 py-2">
            {[
              { label: 'Active', val: stats.accounts.active, color: 'var(--success)' },
              { label: 'Logged Out', val: stats.accounts.logged_out, color: 'var(--warning)' },
              { label: 'Error', val: stats.accounts.error, color: 'var(--error)' },
              { label: 'Proxy Error', val: stats.accounts.proxy_error, color: 'orange' },
              { label: 'Banned', val: stats.accounts.banned, color: 'red' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center text-sm py-1 border-b border-dashed border-gray-100 last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span className="font-semibold" style={{ color: item.color }}>{item.val}</span>
              </div>
            ))}
          </div>
        )
      case 'profiles':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 py-2">
            {[
              { label: 'Running', val: stats.profiles.running, color: 'var(--accent)' },
              { label: 'Idle', val: stats.profiles.idle, color: 'var(--text-muted)' },
              { label: 'Starting', val: stats.profiles.starting, color: 'indigo' },
              { label: 'Stopping', val: stats.profiles.stopping, color: 'orange' },
              { label: 'Error', val: stats.profiles.error, color: 'var(--error)' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center text-sm py-1 border-b border-dashed border-gray-100 last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span className="font-semibold" style={{ color: item.color }}>{item.val}</span>
              </div>
            ))}
          </div>
        )
      case 'proxies':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 py-2">
            {[
              { label: 'Active', val: stats.proxies.active, color: 'var(--success)' },
              { label: 'Checking', val: stats.proxies.checking, color: 'var(--accent)' },
              { label: 'Error', val: stats.proxies.error, color: 'orange' },
              { label: 'Dead', val: stats.proxies.dead, color: 'var(--error)' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center text-sm py-1 border-b border-dashed border-gray-100 last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span className="font-semibold" style={{ color: item.color }}>{item.val}</span>
              </div>
            ))}
          </div>
        )
      case 'executions':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 py-2">
            {[
              { label: 'Completed', val: stats.executions.completed, color: 'var(--success)' },
              { label: 'Running', val: stats.executions.running, color: 'var(--accent)' },
              { label: 'Pending', val: stats.executions.pending, color: 'var(--warning)' },
              { label: 'Failed', val: stats.executions.failed, color: 'var(--error)' },
              { label: 'Cancelled', val: stats.executions.cancelled, color: 'var(--text-muted)' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center text-sm py-1 border-b border-dashed border-gray-100 last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span className="font-semibold" style={{ color: item.color }}>{item.val}</span>
              </div>
            ))}
          </div>
        )
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto pb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard Overview</h1>
        <button
          onClick={fetchStats}
          className="px-4 py-2 rounded-md transition-colors text-sm font-medium border"
          style={{ 
            backgroundColor: 'var(--bg-surface)', 
            color: 'var(--text-primary)',
            borderColor: 'var(--border-color)'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {[
          { label: 'Total Accounts', val: stats.accounts.total, sub: `${stats.accounts.active} active`, subColor: 'var(--success)' },
          { label: 'Total Proxies', val: stats.proxies.total, sub: `${stats.proxies.active} active`, subColor: 'var(--success)' },
          { label: 'Total Profiles', val: stats.profiles.total, sub: `${stats.profiles.running} running`, subColor: 'var(--accent)' },
          { label: 'Logs (24h)', val: stats.logs24h, sub: 'System events', subColor: 'var(--text-muted)' },
        ].map((kpi, idx) => (
          <div key={idx} className="overflow-hidden shadow-sm rounded-xl border flex flex-col" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <div className="p-4 flex-1 flex flex-col justify-center">
              <div className="flex items-center">
                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.val}</div>
                <div className="ml-4 w-0 flex-1">
                  <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</div>
                  <div className="text-sm font-semibold" style={{ color: kpi.subColor }}>{kpi.sub}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Layout: Charts (2/3) and Secondary Panel (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column: Expanded Charts Array */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          {/* Main Activity Chart - Expanded */}
          <div className="shadow-sm rounded-xl border p-4 flex flex-col flex-1 min-h-[300px]" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>Activity Trend (7 Days)</h2>
            <div className="flex-1 w-full" style={{ minHeight: '220px' }}>
              <ActivityChart data={stats.timeline} />
            </div>
          </div>

          {/* Lower Chart Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Account Types Donut Chart */}
            <div className="shadow-sm rounded-xl border p-4 flex flex-col min-h-[260px]" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>Account Distribution</h2>
              <div className="flex-1 w-full">
                <AccountTypesChart data={stats.accounts.byType} />
              </div>
            </div>

            {/* Dashboard Details Manager - Tabs */}
            <div className="shadow-sm rounded-xl border p-4 flex flex-col min-h-[260px]" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 flex justify-between items-center" style={{ color: 'var(--text-secondary)' }}>
                System Details Menu
              </h2>
              {/* Custom Tab Header */}
              <div className="flex space-x-1 mb-3 bg-gray-100 dark:bg-[#1a1a1a] p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-surface-2)' }}>
                {(['accounts', 'profiles', 'proxies', 'executions'] as TabKey[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 text-[10px] font-medium py-1.5 px-1 rounded-md capitalize transition-all ${activeTab === tab ? 'bg-white shadow-sm dark:bg-[#2d2d2d] text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Alerts */}
        <div className="lg:col-span-1 flex flex-col h-full">
          <SmartAlerts 
            inactiveAccounts={stats.inactiveAccounts}
            bannedAccounts={stats.bannedAccounts}
            deadProxies={stats.deadProxies}
          />
        </div>
      </div>

    </div>
  )
}
