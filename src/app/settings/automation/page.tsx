'use client'

import { useEffect, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'

interface TaskEngineConfig {
  maxConcurrentTasks: number
}

interface ModuleSchedule {
  id: string
  moduleName: string
  type: 'check' | 'care'
  scheduleType: 'interval' | 'daily' | 'weekly'
  intervalMin: number | null
  hour: number | null
  minute: number | null
  daysOfWeek: string | null // JSON array
  accountIds: string | null // JSON array of account IDs
  profileId: string | null // Profile ID
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
}

interface Module {
  name: string
  label: string
}

interface Account {
  id: string
  label: string
  accountType: string
  identifier: string // Email/username
  status: string
  gpmloginProfileId?: string | null
}

interface Profile {
  id: string
  name: string
  profileUid: string
  status: string
  groupId: number | null
}

interface SchedulerRun {
  id: string
  scheduleId: string
  status: 'running' | 'completed' | 'failed' | 'skipped'
  accountsEnqueued: number
  accountsProcessed: number | null
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  metaJson: string | null
  createdAt: string
  schedule?: {
    id: string
    moduleName: string
    type: 'check' | 'care'
    scheduleType: 'interval' | 'daily' | 'weekly'
  }
}

type ScheduleType = 'interval' | 'daily' | 'weekly'

const DAYS_OF_WEEK = [
  { value: 0, label: 'Chủ nhật' },
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
]

export default function AutomationSettingsPage() {
  const [taskEngineConfig, setTaskEngineConfig] = useState<TaskEngineConfig>({
    maxConcurrentTasks: 3,
  })
  const [schedules, setSchedules] = useState<ModuleSchedule[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ModuleSchedule | null>(null)
  const [scheduleForm, setScheduleForm] = useState({
    moduleName: 'gmail',
    type: 'care' as 'check' | 'care',
    scheduleType: 'daily' as ScheduleType,
    intervalMin: 180 as number | null,
    hour: 9 as number | null,
    minute: 0 as number | null,
    daysOfWeek: [] as number[],
    accountIds: [] as string[], // Empty = all accounts
    profileId: null as string | null, // Profile ID - null = all profiles
    enabled: true,
  })
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [schedulerRuns, setSchedulerRuns] = useState<SchedulerRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [runFilters, setRunFilters] = useState({
    scheduleId: '',
    status: '',
    limit: 50,
    offset: 0,
  })
  const [selectedRun, setSelectedRun] = useState<SchedulerRun | null>(null)
  const [showRunModal, setShowRunModal] = useState(false)
  const { showToast } = useToastContext()

  useEffect(() => {
    fetchData()
    fetchSchedulerRuns()
    const interval = setInterval(fetchSchedules, 60000) // Refresh schedules every 60s
    const runsInterval = setInterval(fetchSchedulerRuns, 30000) // Refresh runs every 30s
    return () => {
      clearInterval(interval)
      clearInterval(runsInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchSchedulerRuns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runFilters.scheduleId, runFilters.status, runFilters.limit, runFilters.offset])

  const fetchData = async () => {
    setLoading(true)
    await Promise.all([fetchTaskEngineConfig(), fetchSchedules(), fetchModules()])
    setLoading(false)
  }

  const fetchTaskEngineConfig = async () => {
    try {
      const res = await fetch('/api/settings/task-engine')
      const data = await res.json()
      if (data.success) {
        setTaskEngineConfig(data.config)
      }
    } catch (error) {
      console.error('Error fetching task engine config:', error)
    }
  }

  const fetchSchedules = async () => {
    try {
      const res = await fetch('/api/schedules')
      const data = await res.json()
      if (data.success) {
        setSchedules(data.schedules)
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
    }
  }

  const fetchModules = async () => {
    try {
      const res = await fetch('/api/modules')
      const data = await res.json()
      if (data.success) {
        setModules(data.modules)
      }
    } catch (error) {
      console.error('Error fetching modules:', error)
    }
  }

  const saveTaskEngineConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/task-engine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskEngineConfig),
      })

      const data = await res.json()
      if (data.success) {
        showToast('Task engine config saved', 'success')
      } else {
        showToast(data.error || 'Error saving config', 'error')
      }
    } catch (error) {
      console.error('Error saving task engine config:', error)
      showToast('Error saving config', 'error')
    } finally {
      setSaving(false)
    }
  }

  const fetchProfiles = async () => {
    setLoadingProfiles(true)
    try {
      const res = await fetch('/api/profiles')
      const data = await res.json()
      if (data.success) {
        setProfiles(data.profiles || [])
      }
    } catch (error) {
      console.error('Error fetching profiles:', error)
      showToast('Error loading profiles', 'error')
    } finally {
      setLoadingProfiles(false)
    }
  }

  const fetchAccountsForModule = async (moduleName: string, profileId: string | null = null) => {
    setLoadingAccounts(true)
    try {
      let url = `/api/accounts?type=${moduleName}`
      if (profileId) {
        // Fetch accounts by profile - need to get accounts that belong to this profile
        const res = await fetch(url)
        const data = await res.json()
        if (data.success) {
          // Filter accounts by profileId
          const allAccounts = data.accounts || []
          const filteredAccounts = allAccounts.filter(
            (acc: Account) => acc.gpmloginProfileId === profileId
          )
          setAccounts(filteredAccounts)
        }
      } else {
        // Fetch all accounts of module
        const res = await fetch(url)
        const data = await res.json()
        if (data.success) {
          setAccounts(data.accounts || [])
        }
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      showToast('Error loading accounts', 'error')
    } finally {
      setLoadingAccounts(false)
    }
  }

  const openScheduleModal = async (schedule?: ModuleSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule)
      let daysOfWeek: number[] = []
      if (schedule.daysOfWeek) {
        try {
          daysOfWeek = JSON.parse(schedule.daysOfWeek) as number[]
        } catch {
          daysOfWeek = []
        }
      }

      let accountIds: string[] = []
      if (schedule.accountIds) {
        try {
          accountIds = JSON.parse(schedule.accountIds) as string[]
        } catch {
          accountIds = []
        }
      }

      setScheduleForm({
        moduleName: schedule.moduleName,
        type: schedule.type,
        scheduleType: schedule.scheduleType || 'interval',
        intervalMin: schedule.intervalMin,
        hour: schedule.hour,
        minute: schedule.minute,
        daysOfWeek,
        accountIds,
        profileId: schedule.profileId || null,
        enabled: schedule.enabled,
      })
      await fetchProfiles()
      await fetchAccountsForModule(schedule.moduleName, schedule.profileId || null)
    } else {
      setEditingSchedule(null)
      setScheduleForm({
        moduleName: 'gmail',
        type: 'care',
        scheduleType: 'daily',
        intervalMin: 180,
        hour: 9,
        minute: 0,
        daysOfWeek: [],
        accountIds: [],
        profileId: null,
        enabled: true,
      })
      await fetchProfiles()
      await fetchAccountsForModule('gmail', null)
    }
    setShowScheduleModal(true)
  }

  const closeScheduleModal = () => {
    setShowScheduleModal(false)
    setEditingSchedule(null)
  }

  const saveSchedule = async () => {
    setSaving(true)
    try {
      const url = editingSchedule
        ? `/api/schedules/${editingSchedule.id}`
        : '/api/schedules'
      const method = editingSchedule ? 'PATCH' : 'POST'

      const payload: any = {
        moduleName: scheduleForm.moduleName,
        type: scheduleForm.type,
        scheduleType: scheduleForm.scheduleType,
        enabled: scheduleForm.enabled,
      }

      if (scheduleForm.scheduleType === 'interval') {
        payload.intervalMin = scheduleForm.intervalMin
      } else if (scheduleForm.scheduleType === 'daily') {
        payload.hour = scheduleForm.hour
        payload.minute = scheduleForm.minute
      } else if (scheduleForm.scheduleType === 'weekly') {
        payload.hour = scheduleForm.hour
        payload.minute = scheduleForm.minute
        payload.daysOfWeek = scheduleForm.daysOfWeek
      }

      // Add accountIds - empty array or null = all accounts
      payload.accountIds = scheduleForm.accountIds && scheduleForm.accountIds.length > 0 ? scheduleForm.accountIds : null
      // Add profileId - null = all profiles
      payload.profileId = scheduleForm.profileId || null
      // Add profileId - null = all profiles
      payload.profileId = scheduleForm.profileId || null

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (data.success) {
        showToast(
          `Schedule ${editingSchedule ? 'updated' : 'created'} successfully`,
          'success'
        )
        closeScheduleModal()
        fetchSchedules()
      } else {
        showToast(data.error || 'Error saving schedule', 'error')
      }
    } catch (error) {
      console.error('Error saving schedule:', error)
      showToast('Error saving schedule', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleSchedule = async (schedule: ModuleSchedule) => {
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      })

      const data = await res.json()
      if (data.success) {
        showToast(
          `Schedule ${!schedule.enabled ? 'enabled' : 'disabled'}`,
          'success'
        )
        fetchSchedules()
      } else {
        showToast(data.error || 'Error updating schedule', 'error')
      }
    } catch (error) {
      console.error('Error toggling schedule:', error)
      showToast('Error updating schedule', 'error')
    }
  }

  const deleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return
    }

    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (data.success) {
        showToast('Schedule deleted', 'success')
        fetchSchedules()
      } else {
        showToast(data.error || 'Error deleting schedule', 'error')
      }
    } catch (error) {
      console.error('Error deleting schedule:', error)
      showToast('Error deleting schedule', 'error')
    }
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (remainingSeconds === 0) return `${minutes}m`
    return `${minutes}m ${remainingSeconds}s`
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      skipped: 'bg-gray-100 text-gray-800',
    }
    return (
      <span
        className={`px-2 py-1 rounded text-xs font-semibold ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}
      >
        {status}
      </span>
    )
  }

  const openRunModal = (run: SchedulerRun) => {
    setSelectedRun(run)
    setShowRunModal(true)
  }

  const closeRunModal = () => {
    setShowRunModal(false)
    setSelectedRun(null)
  }

  const fetchSchedulerRuns = async () => {
    setLoadingRuns(true)
    try {
      const params = new URLSearchParams()
      if (runFilters.scheduleId) params.append('scheduleId', runFilters.scheduleId)
      if (runFilters.status) params.append('status', runFilters.status)
      params.append('limit', runFilters.limit.toString())
      params.append('offset', runFilters.offset.toString())

      const res = await fetch(`/api/scheduler-runs?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setSchedulerRuns(data.data)
      }
    } catch (error) {
      console.error('Error fetching scheduler runs:', error)
    } finally {
      setLoadingRuns(false)
    }
  }

  const formatScheduleInfo = (schedule: ModuleSchedule) => {
    if (schedule.scheduleType === 'interval') {
      if (!schedule.intervalMin) return 'N/A'
      const mins = schedule.intervalMin
      if (mins < 60) return `Mỗi ${mins} phút`
      const hours = Math.floor(mins / 60)
      const remainder = mins % 60
      if (remainder === 0) return `Mỗi ${hours} giờ`
      return `Mỗi ${hours} giờ ${remainder} phút`
    } else if (schedule.scheduleType === 'daily') {
      if (schedule.hour === null || schedule.minute === null) return 'N/A'
      const h = String(schedule.hour).padStart(2, '0')
      const m = String(schedule.minute).padStart(2, '0')
      return `Mỗi ngày lúc ${h}:${m}`
    } else if (schedule.scheduleType === 'weekly') {
      if (schedule.hour === null || schedule.minute === null) return 'N/A'
      const h = String(schedule.hour).padStart(2, '0')
      const m = String(schedule.minute).padStart(2, '0')
      let days: number[] = []
      if (schedule.daysOfWeek) {
        try {
          days = JSON.parse(schedule.daysOfWeek) as number[]
        } catch {
          days = []
        }
      }
      if (days.length === 0) return `N/A`
      const dayLabels = days
        .sort()
        .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label)
        .filter(Boolean)
        .join(', ')
      return `Mỗi ${dayLabels} lúc ${h}:${m}`
    }
    return 'N/A'
  }

  const toggleDayOfWeek = (day: number) => {
    const currentDays = scheduleForm.daysOfWeek || []
    if (currentDays.includes(day)) {
      setScheduleForm({
        ...scheduleForm,
        daysOfWeek: currentDays.filter((d) => d !== day),
      })
    } else {
      setScheduleForm({
        ...scheduleForm,
        daysOfWeek: [...currentDays, day],
      })
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Automation Settings</h1>
      </div>

      {/* Task Engine Config */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Task Engine Configuration
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Số luồng chạy song song (Max Concurrent Tasks)
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={taskEngineConfig.maxConcurrentTasks}
              onChange={(e) =>
                setTaskEngineConfig({
                  maxConcurrentTasks: parseInt(e.target.value) || 3,
                })
              }
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Số lượng tasks tối đa được phép chạy đồng thời (1-50)
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={saveTaskEngineConfig}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Module Schedules */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Scheduled Tasks
          </h2>
          <button
            onClick={() => openScheduleModal()}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            + Add Schedule
          </button>
        </div>

        {schedules.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No schedules configured. Click "Add Schedule" to create one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Module
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Run
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Run
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {schedule.moduleName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          schedule.type === 'care'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {schedule.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatScheduleInfo(schedule)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleSchedule(schedule)}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                          schedule.enabled
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                        }`}
                      >
                        {schedule.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(schedule.lastRunAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(schedule.nextRunAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                      <button
                        onClick={() => openScheduleModal(schedule)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteSchedule(schedule.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scheduler Runs History */}
      <div className="bg-white shadow rounded-lg p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Scheduler Run History
          </h2>
          <button
            onClick={fetchSchedulerRuns}
            disabled={loadingRuns}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingRuns ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule
            </label>
            <select
              value={runFilters.scheduleId}
              onChange={(e) =>
                setRunFilters({ ...runFilters, scheduleId: e.target.value, offset: 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Schedules</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.moduleName} - {s.type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={runFilters.status}
              onChange={(e) =>
                setRunFilters({ ...runFilters, status: e.target.value, offset: 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Limit
            </label>
            <select
              value={runFilters.limit}
              onChange={(e) =>
                setRunFilters({
                  ...runFilters,
                  limit: parseInt(e.target.value),
                  offset: 0,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
        </div>

        {/* Runs Table */}
        {loadingRuns ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading runs...</p>
          </div>
        ) : schedulerRuns.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No scheduler runs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accounts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Error
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schedulerRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {run.schedule ? (
                        <div>
                          <div className="font-medium text-gray-900">
                            {run.schedule.moduleName}
                          </div>
                          <div className="text-gray-500">{run.schedule.type}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Schedule deleted</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(run.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      <div>Enqueued: {run.accountsEnqueued}</div>
                      {run.accountsProcessed !== null && (
                        <div className="text-xs text-gray-400">
                          Processed: {run.accountsProcessed}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(run.startedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDuration(run.durationMs)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {run.errorMessage ? (
                        <span className="text-red-600 truncate block max-w-xs" title={run.errorMessage}>
                          {run.errorMessage.substring(0, 50)}...
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <button
                        onClick={() => openRunModal(run)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
            <h3 className="text-lg font-semibold mb-4">
              {editingSchedule ? 'Edit Schedule' : 'Create Schedule'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loại Account (Email/X/Facebook...)
                </label>
                <select
                  value={scheduleForm.moduleName}
                  onChange={async (e) => {
                    const accountType = e.target.value
                    setScheduleForm({ 
                      ...scheduleForm, 
                      moduleName: accountType, 
                      accountIds: [], 
                      profileId: null 
                    })
                    await fetchAccountsForModule(accountType, null)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {modules.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Chọn loại account để hiển thị danh sách accounts tương ứng
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={scheduleForm.type}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      type: e.target.value as 'check' | 'care',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="check">Check</option>
                  <option value="care">Care</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Type
                </label>
                <select
                  value={scheduleForm.scheduleType}
                  onChange={(e) => {
                    const newType = e.target.value as ScheduleType
                    setScheduleForm({
                      ...scheduleForm,
                      scheduleType: newType,
                      // Reset form based on type
                      intervalMin: newType === 'interval' ? 180 : null,
                      hour: newType !== 'interval' ? 9 : null,
                      minute: newType !== 'interval' ? 0 : null,
                      daysOfWeek: newType === 'weekly' ? [] : [],
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="interval">Interval (Mỗi X phút)</option>
                  <option value="daily">Daily (Mỗi ngày vào giờ X:Y)</option>
                  <option value="weekly">Weekly (Mỗi tuần vào các ngày X, giờ Y:Z)</option>
                </select>
              </div>

              {/* Interval Configuration */}
              {scheduleForm.scheduleType === 'interval' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interval (phút)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={scheduleForm.intervalMin || ''}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        intervalMin: parseInt(e.target.value) || null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {scheduleForm.intervalMin && (
                    <p className="mt-1 text-sm text-gray-500">
                      {scheduleForm.intervalMin < 60
                        ? `Mỗi ${scheduleForm.intervalMin} phút`
                        : `Mỗi ${Math.floor(scheduleForm.intervalMin / 60)} giờ ${scheduleForm.intervalMin % 60} phút`}
                    </p>
                  )}
                </div>
              )}

              {/* Daily/Weekly Time Configuration */}
              {(scheduleForm.scheduleType === 'daily' ||
                scheduleForm.scheduleType === 'weekly') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Giờ (0-23)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={scheduleForm.hour ?? ''}
                        onChange={(e) =>
                          setScheduleForm({
                            ...scheduleForm,
                            hour: parseInt(e.target.value) || null,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phút (0-59)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={scheduleForm.minute ?? ''}
                        onChange={(e) =>
                          setScheduleForm({
                            ...scheduleForm,
                            minute: parseInt(e.target.value) || null,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  {scheduleForm.hour !== null && scheduleForm.minute !== null && (
                    <p className="text-sm text-gray-500">
                      Thời gian: {String(scheduleForm.hour).padStart(2, '0')}:
                      {String(scheduleForm.minute).padStart(2, '0')}
                    </p>
                  )}
                </>
              )}

              {/* Weekly Days Configuration */}
              {scheduleForm.scheduleType === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chọn các ngày trong tuần
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <label
                        key={day.value}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={scheduleForm.daysOfWeek.includes(day.value)}
                          onChange={() => toggleDayOfWeek(day.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{day.label}</span>
                      </label>
                    ))}
                  </div>
                  {scheduleForm.daysOfWeek.length === 0 && (
                    <p className="mt-1 text-sm text-red-500">
                      Vui lòng chọn ít nhất một ngày
                    </p>
                  )}
                </div>
              )}

              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chọn Accounts {scheduleForm.moduleName ? `(${scheduleForm.moduleName})` : ''}
                </label>
                {!scheduleForm.moduleName ? (
                  <div className="border border-gray-300 rounded-md p-4 text-center text-gray-500">
                    Vui lòng chọn loại account trước
                  </div>
                ) : (
                  <div className="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto">
                    {loadingAccounts ? (
                      <div className="text-sm text-gray-500">Đang tải...</div>
                    ) : accounts.length === 0 ? (
                      <div className="text-sm text-gray-500">Không có accounts của loại {scheduleForm.moduleName}</div>
                    ) : (
                    <>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          Đã chọn: {scheduleForm.accountIds.length} / {accounts.length}
                        </span>
                        <div className="space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              setScheduleForm({
                                ...scheduleForm,
                                accountIds: accounts.map((a) => a.id),
                              })
                            }
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Chọn tất cả
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setScheduleForm({ ...scheduleForm, accountIds: [] })
                            }
                            className="text-xs text-gray-600 hover:text-gray-800"
                          >
                            Bỏ chọn tất cả
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {accounts.map((account) => (
                          <label
                            key={account.id}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={scheduleForm.accountIds.includes(account.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setScheduleForm({
                                    ...scheduleForm,
                                    accountIds: [...scheduleForm.accountIds, account.id],
                                  })
                                } else {
                                  setScheduleForm({
                                    ...scheduleForm,
                                    accountIds: scheduleForm.accountIds.filter(
                                      (id) => id !== account.id
                                    ),
                                  })
                                }
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="text-sm text-gray-700 flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {account.label || 'No label'}
                              </div>
                              <div className="text-xs text-gray-500 truncate" title={account.identifier}>
                                {account.identifier}
                              </div>
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
                                account.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : account.status === 'error'
                                    ? 'bg-red-100 text-red-800'
                                    : account.status === 'logged_out'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {account.status}
                            </span>
                          </label>
                        ))}
                      </div>
                      {scheduleForm.accountIds.length === 0 && (
                        <p className="mt-2 text-sm text-gray-500">
                          Sẽ chạy tất cả accounts của loại {scheduleForm.moduleName}
                        </p>
                      )}
                    </>
                  )}
                </div>
                )}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={scheduleForm.enabled}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, enabled: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
                  Enabled
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={closeScheduleModal}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={saveSchedule}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduler Run Detail Modal */}
      {showRunModal && selectedRun && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 my-8">
            <h3 className="text-lg font-semibold mb-4">Scheduler Run Details</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div>{getStatusBadge(selectedRun.status)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Run ID
                  </label>
                  <div className="text-sm text-gray-600 font-mono">
                    {selectedRun.id}
                  </div>
                </div>
              </div>

              {selectedRun.schedule && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Schedule
                  </label>
                  <div className="text-sm text-gray-600">
                    {selectedRun.schedule.moduleName} - {selectedRun.schedule.type} (
                    {selectedRun.schedule.scheduleType})
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accounts Enqueued
                  </label>
                  <div className="text-sm text-gray-600">
                    {selectedRun.accountsEnqueued}
                  </div>
                </div>
                {selectedRun.accountsProcessed !== null && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Accounts Processed
                    </label>
                    <div className="text-sm text-gray-600">
                      {selectedRun.accountsProcessed}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Started At
                  </label>
                  <div className="text-sm text-gray-600">
                    {formatDateTime(selectedRun.startedAt)}
                  </div>
                </div>
                {selectedRun.completedAt && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Completed At
                    </label>
                    <div className="text-sm text-gray-600">
                      {formatDateTime(selectedRun.completedAt)}
                    </div>
                  </div>
                )}
              </div>

              {selectedRun.durationMs !== null && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration
                  </label>
                  <div className="text-sm text-gray-600">
                    {formatDuration(selectedRun.durationMs)} ({selectedRun.durationMs}ms)
                  </div>
                </div>
              )}

              {selectedRun.errorMessage && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Error Message
                  </label>
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200 font-mono whitespace-pre-wrap break-words">
                    {selectedRun.errorMessage}
                  </div>
                </div>
              )}

              {selectedRun.metaJson && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Information
                  </label>
                  <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded border border-gray-200 overflow-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedRun.metaJson), null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={closeRunModal}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
