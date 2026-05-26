'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'
import { Users, Globe, Shield, Zap, RefreshCw, Activity, BarChart3 } from 'lucide-react'
import { StatCard } from '@/components/ui/Card'
import Card, { CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'
import { SkeletonCard } from '@/components/ui/Skeleton'
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
  timeline: { date: string; count: number }[]
  inactiveAccounts: { id: string; label: string; accountType: string; lastCare: string | null; createdAt: string }[]
  bannedAccounts: { id: string; label: string; accountType: string; status: string }[]
  deadProxies: { id: string; label: string; rawProxy: string; status: string }[]
}

type TabKey = 'accounts' | 'profiles' | 'proxies' | 'executions'

const tabDetailConfigs: Record<TabKey, { label: string; color: string }[]> = {
  accounts: [
    { label: 'Active', color: 'text-emerald-400' },
    { label: 'Logged Out', color: 'text-amber-400' },
    { label: 'Error', color: 'text-red-400' },
    { label: 'Proxy Error', color: 'text-orange-400' },
    { label: 'Banned', color: 'text-red-500' },
  ],
  profiles: [
    { label: 'Running', color: 'text-indigo-400' },
    { label: 'Idle', color: 'text-gray-400' },
    { label: 'Starting', color: 'text-blue-400' },
    { label: 'Stopping', color: 'text-amber-400' },
    { label: 'Error', color: 'text-red-400' },
  ],
  proxies: [
    { label: 'Active', color: 'text-emerald-400' },
    { label: 'Checking', color: 'text-indigo-400' },
    { label: 'Error', color: 'text-orange-400' },
    { label: 'Dead', color: 'text-red-400' },
  ],
  executions: [
    { label: 'Completed', color: 'text-emerald-400' },
    { label: 'Running', color: 'text-indigo-400' },
    { label: 'Pending', color: 'text-amber-400' },
    { label: 'Failed', color: 'text-red-400' },
    { label: 'Cancelled', color: 'text-gray-500' },
  ],
}

function getTabValues(stats: Stats, tab: TabKey): number[] {
  switch (tab) {
    case 'accounts':
      return [stats.accounts.active, stats.accounts.logged_out, stats.accounts.error, stats.accounts.proxy_error, stats.accounts.banned]
    case 'profiles':
      return [stats.profiles.running, stats.profiles.idle, stats.profiles.starting, stats.profiles.stopping, stats.profiles.error]
    case 'proxies':
      return [stats.proxies.active, stats.proxies.checking, stats.proxies.error, stats.proxies.dead]
    case 'executions':
      return [stats.executions.completed, stats.executions.running, stats.executions.pending, stats.executions.failed, stats.executions.cancelled]
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('accounts')
  const { showToast } = useToastContext()

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      if (data.success) setStats(data.stats)
      else showToast('Error loading stats', 'error')
    } catch {
      showToast('Error loading stats', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStats()
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-400 text-sm mb-4">Error loading dashboard data</p>
        <Button onClick={fetchStats}>Retry</Button>
      </div>
    )
  }

  const tabsList = [
    { key: 'accounts', label: 'Accounts', count: stats.accounts.total },
    { key: 'profiles', label: 'Profiles', count: stats.profiles.total },
    { key: 'proxies', label: 'Proxies', count: stats.proxies.total },
    { key: 'executions', label: 'Tasks', count: stats.executions.total },
  ]

  const detailConfigs = tabDetailConfigs[activeTab]
  const detailValues = getTabValues(stats, activeTab)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>System overview and monitoring</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Accounts"
          value={stats.accounts.total}
          icon={<Users size={16} />}
          variant={stats.accounts.error > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Profiles"
          value={stats.profiles.total}
          icon={<Globe size={16} />}
          variant={stats.profiles.running > 0 ? 'success' : 'default'}
        />
        <StatCard
          label="Proxies"
          value={stats.proxies.total}
          icon={<Shield size={16} />}
          variant={stats.proxies.dead > 0 ? 'error' : 'default'}
        />
        <StatCard
          label="Tasks (24h)"
          value={stats.logs24h}
          icon={<Zap size={16} />}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity Chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Activity Trend" description="Last 7 days" action={<Activity size={16} style={{ color: 'var(--text-muted)' }} />} />
            <div className="h-[220px] sm:h-[260px]">
              <ActivityChart data={stats.timeline} />
            </div>
          </Card>
        </div>

        {/* Smart Alerts */}
        <div className="lg:col-span-1">
          <SmartAlerts
            inactiveAccounts={stats.inactiveAccounts}
            bannedAccounts={stats.bannedAccounts}
            deadProxies={stats.deadProxies}
          />
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Account Distribution */}
        <Card>
          <CardHeader title="Account Distribution" action={<BarChart3 size={16} style={{ color: 'var(--text-muted)' }} />} />
          <div className="h-[200px]">
            <AccountTypesChart data={stats.accounts.byType} />
          </div>
        </Card>

        {/* System Details */}
        <Card>
          <CardHeader title="System Details" />
          <Tabs tabs={tabsList} active={activeTab} onChange={(k) => setActiveTab(k as TabKey)} />
          <div className="mt-3 space-y-1.5">
            {detailConfigs.map((item, i) => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <Badge variant={detailValues[i] > 0 ? 'default' : 'muted'}>
                  <span className={item.color}>{detailValues[i]}</span>
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
