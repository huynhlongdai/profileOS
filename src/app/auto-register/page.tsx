'use client'

import { useEffect, useMemo, useState } from 'react'
import { useToastContext } from '@/components/ToastProvider'

type ServiceStatus = {
  running: boolean
  pid: number | null
  startedAt: number | null
  baseUrl: string
}

type RegisterTask = {
  id: string
  status: string
  progress: string
  success?: number
  skipped?: number
  errors?: string[]
  logs?: string[]
}

type ScheduledTask = {
  task_id: string
  platform: string
  count: number
  paused?: boolean
  interval_type?: string
  interval_value?: number
  last_run_at?: string | null
  last_run_success?: boolean | null
  last_error?: string | null
}

type TaskLogItem = {
  id: number
  platform: string
  email: string
  status: string
  error?: string
  created_at?: string
}

type ProxyItem = {
  id: number
  url: string
  region?: string
  is_active?: boolean
  success_count?: number
  fail_count?: number
}

type AccountItem = {
  id: number
  platform: string
  email: string
  password: string
  status: string
  token?: string
  created_at?: string
}

type AccountStats = {
  total: number
  by_platform: Record<string, number>
  by_status: Record<string, number>
}

type RegisterFormState = {
  platform: string
  count: number
  concurrency: number
  register_delay_seconds: number
  executor_type: string
  captcha_solver: string
  mail_provider: string
  random_delay_min: number
  random_delay_max: number
  proxy: string
  email: string
  password: string
  solver_url: string
  yescaptcha_key: string
  moemail_api_url: string
  moemail_api_key: string
  skymail_api_base: string
  skymail_token: string
  skymail_domain: string
  luckmail_base_url: string
  luckmail_api_key: string
  luckmail_email_type: string
  luckmail_domain: string
  cpa_api_url: string
  cpa_api_key: string
  sub2api_api_url: string
  sub2api_api_key: string
  sub2api_group_ids: string
}

type IntegrationServiceItem = {
  name: string
  installed?: boolean
  running?: boolean
  status?: string
  message?: string
}

const platformOptions = [
  'chatgpt',
  'trae',
  'cursor',
  'kiro',
  'grok',
  'tavily',
  'openblocklabs',
]

export default function AutoRegisterPage() {
  const { showToast } = useToastContext()
  const [status, setStatus] = useState<ServiceStatus | null>(null)
  const [task, setTask] = useState<RegisterTask | null>(null)
  const [loading, setLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [taskList, setTaskList] = useState<RegisterTask[]>([])
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([])
  const [taskLogs, setTaskLogs] = useState<TaskLogItem[]>([])
  const [selectedLogIds, setSelectedLogIds] = useState<string>('')
  const [proxies, setProxies] = useState<ProxyItem[]>([])
  const [proxyForm, setProxyForm] = useState({
    url: '',
    region: '',
    bulkText: '',
  })
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null)
  const [accountFilters, setAccountFilters] = useState({
    platform: '',
    status: '',
    email: '',
  })
  const [selectedAccountIds, setSelectedAccountIds] = useState<string>('')
  const [integrationServices, setIntegrationServices] = useState<IntegrationServiceItem[]>([])
  const [integrationLoading, setIntegrationLoading] = useState(false)
  const [actionPanel, setActionPanel] = useState({
    platform: 'chatgpt',
    actionId: 'sync_cliproxyapi_status',
    accountIds: '',
    allFiltered: false,
    paramsJson: '{}',
  })
  const [configForm, setConfigForm] = useState({
    yescaptcha_key: '',
    mail_provider: 'luckmail',
    moemail_api_key: '',
    moemail_api_url: '',
    proxy_url: '',
    skymail_api_base: '',
    skymail_token: '',
    skymail_domain: '',
    luckmail_base_url: '',
    luckmail_api_key: '',
    luckmail_email_type: '',
    luckmail_domain: '',
    cpa_api_url: '',
    cpa_api_key: '',
    sub2api_api_url: '',
    sub2api_api_key: '',
    sub2api_group_ids: '',
  })
  const [form, setForm] = useState<RegisterFormState>({
    platform: 'chatgpt',
    count: 1,
    concurrency: 1,
    register_delay_seconds: 0,
    executor_type: 'protocol',
    captcha_solver: 'yescaptcha',
    mail_provider: 'luckmail',
    random_delay_min: 0,
    random_delay_max: 0,
    proxy: '',
    email: '',
    password: '',
    solver_url: '',
    yescaptcha_key: '',
    moemail_api_url: '',
    moemail_api_key: '',
    skymail_api_base: '',
    skymail_token: '',
    skymail_domain: '',
    luckmail_base_url: '',
    luckmail_api_key: '',
    luckmail_email_type: '',
    luckmail_domain: '',
    cpa_api_url: '',
    cpa_api_key: '',
    sub2api_api_url: '',
    sub2api_api_key: '',
    sub2api_group_ids: '',
  })
  const [scheduleForm, setScheduleForm] = useState({
    interval_type: 'minutes',
    interval_value: 30,
  })
  const [activeTab, setActiveTab] = useState<
    'tasks' | 'schedules' | 'proxies' | 'accounts' | 'config' | 'integrations'
  >('tasks')

  const canStartTask = useMemo(() => status?.running && !loading, [status?.running, loading])

  const loadStatus = async () => {
    const res = await fetch('/api/auto-reg/status', { cache: 'no-store' })
    const data = await res.json()
    if (data.success) {
      setStatus(data.status)
    }
  }

  const loadTaskList = async () => {
    const res = await fetch('/api/auto-reg/tasks', { cache: 'no-store' })
    const data = await res.json()
    if (data.success) {
      setTaskList(Array.isArray(data.data) ? data.data : [])
    }
  }

  const loadScheduledTasks = async () => {
    const res = await fetch('/api/auto-reg/schedule', { cache: 'no-store' })
    const data = await res.json()
    if (data.success) {
      setScheduledTasks(data.data?.tasks || [])
    }
  }

  const loadTaskLogs = async () => {
    const res = await fetch('/api/auto-reg/task-logs?page=1&page_size=30', {
      cache: 'no-store',
    })
    const data = await res.json()
    if (data.success) {
      setTaskLogs(data.data?.items || [])
    }
  }

  const loadProxies = async () => {
    const res = await fetch('/api/auto-reg/proxies', { cache: 'no-store' })
    const data = await res.json()
    if (data.success) {
      setProxies(Array.isArray(data.data) ? data.data : [])
    }
  }

  const loadAccounts = async () => {
    const query = new URLSearchParams()
    if (accountFilters.platform) query.set('platform', accountFilters.platform)
    if (accountFilters.status) query.set('status', accountFilters.status)
    if (accountFilters.email) query.set('email', accountFilters.email)
    query.set('page', '1')
    query.set('page_size', '50')
    const res = await fetch(`/api/auto-reg/accounts?${query.toString()}`, { cache: 'no-store' })
    const data = await res.json()
    if (data.success) {
      setAccounts(data.data?.items || [])
    }
  }

  const loadAccountStats = async () => {
    const res = await fetch('/api/auto-reg/accounts/stats', { cache: 'no-store' })
    const data = await res.json()
    if (data.success) {
      setAccountStats(data.data || null)
    }
  }

  const loadIntegrationServices = async () => {
    const res = await fetch('/api/auto-reg/integrations/services', { cache: 'no-store' })
    const data = await res.json()
    if (data.success) {
      setIntegrationServices(data.data?.items || [])
    }
  }

  const startService = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auto-reg/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setStatus(data.status)
      showToast('AutoReg service started', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to start service', 'error')
    } finally {
      setLoading(false)
    }
  }

  const stopService = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auto-reg/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setStatus(data.status)
      showToast('AutoReg service stopped', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to stop service', 'error')
    } finally {
      setLoading(false)
    }
  }

  const startRegisterTask = async () => {
    if (!canStartTask) return
    setLoading(true)
    try {
      const payload = {
        platform: form.platform,
        email: form.email || null,
        password: form.password || null,
        count: Number(form.count),
        concurrency: Number(form.concurrency),
        register_delay_seconds: Number(form.register_delay_seconds),
        random_delay_min: Number(form.random_delay_min || 0) > 0 ? Number(form.random_delay_min) : null,
        random_delay_max: Number(form.random_delay_max || 0) > 0 ? Number(form.random_delay_max) : null,
        proxy: form.proxy || null,
        executor_type: form.executor_type,
        captcha_solver: form.captcha_solver,
        extra: {
          mail_provider: form.mail_provider,
          yescaptcha_key: form.yescaptcha_key || configForm.yescaptcha_key,
          solver_url: form.solver_url,
          moemail_api_url: form.moemail_api_url || configForm.moemail_api_url,
          moemail_api_key: form.moemail_api_key || configForm.moemail_api_key,
          skymail_api_base: form.skymail_api_base || configForm.skymail_api_base,
          skymail_token: form.skymail_token || configForm.skymail_token,
          skymail_domain: form.skymail_domain || configForm.skymail_domain,
          luckmail_base_url: form.luckmail_base_url || configForm.luckmail_base_url,
          luckmail_api_key: form.luckmail_api_key || configForm.luckmail_api_key,
          luckmail_email_type: form.luckmail_email_type || configForm.luckmail_email_type,
          luckmail_domain: form.luckmail_domain || configForm.luckmail_domain,
          cpa_api_url: form.cpa_api_url || configForm.cpa_api_url,
          cpa_api_key: form.cpa_api_key || configForm.cpa_api_key,
          sub2api_api_url: form.sub2api_api_url || configForm.sub2api_api_url,
          sub2api_api_key: form.sub2api_api_key || configForm.sub2api_api_key,
          sub2api_group_ids: form.sub2api_group_ids || configForm.sub2api_group_ids,
        },
      }
      const res = await fetch('/api/auto-reg/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setTask({
        id: data.data.task_id,
        status: 'pending',
        progress: `0/${form.count}`,
      })
      showToast('Register task created', 'success')
      await loadTaskList()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create task', 'error')
    } finally {
      setLoading(false)
    }
  }

  const createSchedule = async () => {
    if (!canStartTask) return
    setScheduleLoading(true)
    try {
      const payload = {
        platform: form.platform,
        count: Number(form.count),
        concurrency: Number(form.concurrency),
        register_delay_seconds: Number(form.register_delay_seconds),
        executor_type: form.executor_type,
        captcha_solver: form.captcha_solver,
        interval_type: scheduleForm.interval_type,
        interval_value: Number(scheduleForm.interval_value),
        extra: {
          mail_provider: form.mail_provider,
          yescaptcha_key: form.yescaptcha_key || configForm.yescaptcha_key,
          moemail_api_url: form.moemail_api_url || configForm.moemail_api_url,
          moemail_api_key: form.moemail_api_key || configForm.moemail_api_key,
          skymail_api_base: form.skymail_api_base || configForm.skymail_api_base,
          skymail_token: form.skymail_token || configForm.skymail_token,
          skymail_domain: form.skymail_domain || configForm.skymail_domain,
          luckmail_base_url: form.luckmail_base_url || configForm.luckmail_base_url,
          luckmail_api_key: form.luckmail_api_key || configForm.luckmail_api_key,
          cpa_api_url: form.cpa_api_url || configForm.cpa_api_url,
          cpa_api_key: form.cpa_api_key || configForm.cpa_api_key,
          sub2api_api_url: form.sub2api_api_url || configForm.sub2api_api_url,
          sub2api_api_key: form.sub2api_api_key || configForm.sub2api_api_key,
          sub2api_group_ids: form.sub2api_group_ids || configForm.sub2api_group_ids,
        },
      }
      const res = await fetch('/api/auto-reg/schedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Scheduled task created', 'success')
      await loadScheduledTasks()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create schedule', 'error')
    } finally {
      setScheduleLoading(false)
    }
  }

  const runScheduleNow = async (taskId: string) => {
    try {
      const res = await fetch(`/api/auto-reg/schedule/${taskId}/run`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Scheduled task started', 'success')
      if (data.data?.task_id) {
        setTask({ id: data.data.task_id, status: 'running', progress: '0/0', logs: [] })
      }
      await loadTaskList()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to run schedule', 'error')
    }
  }

  const toggleSchedule = async (taskId: string) => {
    try {
      const res = await fetch(`/api/auto-reg/schedule/${taskId}/toggle`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Schedule toggled', 'success')
      await loadScheduledTasks()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to toggle schedule', 'error')
    }
  }

  const deleteSchedule = async (taskId: string) => {
    try {
      const res = await fetch(`/api/auto-reg/schedule/${taskId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Schedule deleted', 'success')
      await loadScheduledTasks()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete schedule', 'error')
    }
  }

  const batchDeleteLogs = async () => {
    const ids = selectedLogIds
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isInteger(x) && x > 0)
    if (ids.length === 0) {
      showToast('Please input log IDs (comma separated)', 'error')
      return
    }
    try {
      const res = await fetch('/api/auto-reg/task-logs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast(`Deleted ${data.data.deleted || 0} logs`, 'success')
      setSelectedLogIds('')
      await loadTaskLogs()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete logs', 'error')
    }
  }

  const addProxy = async () => {
    if (!proxyForm.url.trim()) return
    try {
      const res = await fetch('/api/auto-reg/proxies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: proxyForm.url.trim(),
          region: proxyForm.region.trim(),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Proxy added', 'success')
      setProxyForm((prev) => ({ ...prev, url: '' }))
      await loadProxies()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add proxy', 'error')
    }
  }

  const bulkAddProxies = async () => {
    const proxiesInput = proxyForm.bulkText
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
    if (proxiesInput.length === 0) return
    try {
      const res = await fetch('/api/auto-reg/proxies/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          proxies: proxiesInput,
          region: proxyForm.region.trim(),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast(`Added ${data.data?.added ?? 0} proxies`, 'success')
      setProxyForm((prev) => ({ ...prev, bulkText: '' }))
      await loadProxies()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to bulk add proxies', 'error')
    }
  }

  const toggleProxy = async (id: number) => {
    try {
      const res = await fetch(`/api/auto-reg/proxies/${id}/toggle`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      await loadProxies()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to toggle proxy', 'error')
    }
  }

  const deleteProxy = async (id: number) => {
    try {
      const res = await fetch(`/api/auto-reg/proxies/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Proxy deleted', 'success')
      await loadProxies()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete proxy', 'error')
    }
  }

  const checkAllProxies = async () => {
    try {
      const res = await fetch('/api/auto-reg/proxies/check', { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Proxy check started', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to check proxies', 'error')
    }
  }

  const deleteAccount = async (id: number) => {
    try {
      const res = await fetch(`/api/auto-reg/accounts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Account deleted', 'success')
      await loadAccounts()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete account', 'error')
    }
  }

  const batchDeleteAccounts = async () => {
    const ids = selectedAccountIds
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isInteger(x) && x > 0)
    if (ids.length === 0) {
      showToast('Please input account IDs (comma separated)', 'error')
      return
    }
    try {
      const res = await fetch('/api/auto-reg/accounts/batch-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast(`Deleted ${data.data?.deleted ?? 0} accounts`, 'success')
      setSelectedAccountIds('')
      await loadAccounts()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to batch delete accounts', 'error')
    }
  }

  const checkAllAccounts = async () => {
    try {
      const res = await fetch('/api/auto-reg/accounts/check-all', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform: accountFilters.platform || undefined }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Account check-all started', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to check all accounts', 'error')
    }
  }

  const exportAccounts = async () => {
    try {
      const query = new URLSearchParams()
      if (accountFilters.platform) query.set('platform', accountFilters.platform)
      if (accountFilters.status) query.set('status', accountFilters.status)
      const res = await fetch(`/api/auto-reg/accounts/export?${query.toString()}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const blob = new Blob([data.data || ''], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'auto-reg-accounts.csv'
      a.click()
      URL.revokeObjectURL(url)
      showToast('Exported accounts CSV', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to export accounts', 'error')
    }
  }

  const runIntegrationServiceAction = async (
    name: string,
    action: 'start' | 'stop' | 'install',
  ) => {
    try {
      const res = await fetch(`/api/auto-reg/integrations/services/${name}/${action}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast(`${name}: ${action} done`, 'success')
      await loadIntegrationServices()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Integration action failed', 'error')
    }
  }

  const runIntegrationAll = async (action: 'start-all' | 'stop-all') => {
    try {
      const res = await fetch(`/api/auto-reg/integrations/services/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast(`Integration ${action} done`, 'success')
      await loadIntegrationServices()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Integration bulk action failed', 'error')
    }
  }

  const runBackfill = async () => {
    setIntegrationLoading(true)
    try {
      const ids = selectedAccountIds
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isInteger(x) && x > 0)
      const res = await fetch('/api/auto-reg/integrations/backfill', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          platforms: platformOptions,
          account_ids: ids,
          pending_only: false,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast(`Backfill done: success ${data.data?.success ?? 0}`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Backfill failed', 'error')
    } finally {
      setIntegrationLoading(false)
    }
  }

  const executeBatchAction = async () => {
    try {
      const params = JSON.parse(actionPanel.paramsJson || '{}')
      const ids = actionPanel.accountIds
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isInteger(x) && x > 0)
      const payload = {
        account_ids: ids,
        all_filtered: actionPanel.allFiltered,
        email: accountFilters.email,
        status: accountFilters.status,
        params,
      }
      const res = await fetch(
        `/api/auto-reg/actions/${actionPanel.platform}/${actionPanel.actionId}/batch`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast(
        `Action done: success ${data.data?.success ?? 0}, failed ${data.data?.failed ?? 0}`,
        'success',
      )
      await loadAccounts()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Batch action failed', 'error')
    }
  }

  const loadConfig = async () => {
    const res = await fetch('/api/auto-reg/config', { cache: 'no-store' })
    const data = await res.json()
    if (!data.success) return
    setConfigForm((prev) => ({
      ...prev,
      yescaptcha_key: data.data.yescaptcha_key || '',
      mail_provider: data.data.mail_provider || prev.mail_provider,
      moemail_api_key: data.data.moemail_api_key || '',
      moemail_api_url: data.data.moemail_api_url || '',
      proxy_url: data.data.proxy_url || '',
      skymail_api_base: data.data.skymail_api_base || '',
      skymail_token: data.data.skymail_token || '',
      skymail_domain: data.data.skymail_domain || '',
      luckmail_base_url: data.data.luckmail_base_url || '',
      luckmail_api_key: data.data.luckmail_api_key || '',
      luckmail_email_type: data.data.luckmail_email_type || '',
      luckmail_domain: data.data.luckmail_domain || '',
      cpa_api_url: data.data.cpa_api_url || '',
      cpa_api_key: data.data.cpa_api_key || '',
      sub2api_api_url: data.data.sub2api_api_url || '',
      sub2api_api_key: data.data.sub2api_api_key || '',
      sub2api_group_ids: data.data.sub2api_group_ids || '',
    }))
  }

  const saveConfig = async () => {
    setConfigSaving(true)
    try {
      const res = await fetch('/api/auto-reg/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(configForm),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Config updated', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update config', 'error')
    } finally {
      setConfigSaving(false)
    }
  }

  useEffect(() => {
    loadStatus().catch(() => null)
    loadConfig().catch(() => null)
    loadTaskList().catch(() => null)
    loadScheduledTasks().catch(() => null)
    loadTaskLogs().catch(() => null)
    loadProxies().catch(() => null)
    loadAccounts().catch(() => null)
    loadAccountStats().catch(() => null)
    loadIntegrationServices().catch(() => null)
  }, [])

  useEffect(() => {
    if (!task?.id) return
    const timer = setInterval(async () => {
      const res = await fetch(`/api/auto-reg/tasks/${task.id}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        setTask(data.data)
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [task?.id])

  useEffect(() => {
    if (!status?.running) return
    const timer = setInterval(() => {
      loadTaskList().catch(() => null)
      loadScheduledTasks().catch(() => null)
      loadAccounts().catch(() => null)
      loadAccountStats().catch(() => null)
      loadIntegrationServices().catch(() => null)
    }, 5000)
    return () => clearInterval(timer)
  }, [status?.running])

  useEffect(() => {
    loadAccounts().catch(() => null)
    loadAccountStats().catch(() => null)
  }, [accountFilters.platform, accountFilters.status, accountFilters.email])

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Auto Register Module</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Automated account registration</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'tasks', label: 'Tasks' },
          { id: 'schedules', label: 'Schedules' },
          { id: 'proxies', label: 'Proxies' },
          { id: 'accounts', label: 'Accounts' },
          { id: 'config', label: 'Config' },
          { id: 'integrations', label: 'Integrations' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === tab.id ? 'text-white' : ''}`}
            style={activeTab === tab.id ? { backgroundColor: 'var(--accent)' } : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Service: {status?.running ? 'Running' : 'Stopped'} | PID: {status?.pid ?? '-'} | Base URL:{' '}
          {status?.baseUrl ?? '-'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={startService}
            disabled={loading || status?.running}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-colors bg-emerald-600"
          >
            Start AutoReg
          </button>
          <button
            onClick={stopService}
            disabled={loading || !status?.running}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-colors bg-red-600"
          >
            Stop AutoReg
          </button>
          <button
            onClick={() => loadStatus().catch(() => null)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
          >
            Refresh Status
          </button>
        </div>
      </div>

      {activeTab === 'config' ? <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>AutoReg Core Config</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Mail provider (default)
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.mail_provider}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, mail_provider: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            YesCaptcha key
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.yescaptcha_key}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, yescaptcha_key: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            MoeMail API URL
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.moemail_api_url}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, moemail_api_url: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            MoeMail API Key
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.moemail_api_key}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, moemail_api_key: e.target.value }))
              }
            />
          </label>
          <label className="text-sm md:col-span-2">
            Proxy URL (optional)
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.proxy_url}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, proxy_url: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            SkyMail API Base
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.skymail_api_base}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, skymail_api_base: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            SkyMail Token
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.skymail_token}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, skymail_token: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            SkyMail Domain
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.skymail_domain}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, skymail_domain: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            LuckMail Base URL
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.luckmail_base_url}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, luckmail_base_url: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            LuckMail API Key
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.luckmail_api_key}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, luckmail_api_key: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            LuckMail Email Type
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.luckmail_email_type}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, luckmail_email_type: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            LuckMail Domain
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.luckmail_domain}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, luckmail_domain: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            CPA API URL
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.cpa_api_url}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, cpa_api_url: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            CPA API Key
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.cpa_api_key}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, cpa_api_key: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Sub2API URL
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.sub2api_api_url}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, sub2api_api_url: e.target.value }))
              }
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Sub2API Key
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.sub2api_api_key}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, sub2api_api_key: e.target.value }))
              }
            />
          </label>
          <label className="text-sm md:col-span-2">
            Sub2API Group IDs
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={configForm.sub2api_group_ids}
              onChange={(e) =>
                setConfigForm((prev) => ({ ...prev, sub2api_group_ids: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveConfig}
            disabled={configSaving || !status?.running}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-colors" style={{ backgroundColor: 'var(--accent)' }}
          >
            Save Config
          </button>
          <button
            onClick={() => loadConfig().catch(() => null)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
          >
            Reload Config
          </button>
        </div>
      </div> : null}

      {activeTab === 'tasks' ? <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Create Register Task</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Platform
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.platform}
              onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
            >
              {platformOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Mail provider
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.mail_provider}
              onChange={(e) => setForm((prev) => ({ ...prev, mail_provider: e.target.value }))}
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Count
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.count}
              onChange={(e) => setForm((prev) => ({ ...prev, count: Number(e.target.value || 1) }))}
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Concurrency
            <input
              type="number"
              min={1}
              max={5}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.concurrency}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, concurrency: Number(e.target.value || 1) }))
              }
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Delay seconds
            <input
              type="number"
              min={0}
              step={0.5}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.register_delay_seconds}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  register_delay_seconds: Number(e.target.value || 0),
                }))
              }
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Random delay min
            <input
              type="number"
              min={0}
              step={0.5}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={(form as any).random_delay_min ?? 0}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  random_delay_min: Number(e.target.value || 0),
                }) as any)
              }
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Random delay max
            <input
              type="number"
              min={0}
              step={0.5}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={(form as any).random_delay_max ?? 0}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  random_delay_max: Number(e.target.value || 0),
                }) as any)
              }
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task proxy (optional)
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={(form as any).proxy ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  proxy: e.target.value,
                }) as any)
              }
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Fixed email (optional)
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={(form as any).email ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  email: e.target.value,
                }) as any)
              }
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Fixed password (optional)
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={(form as any).password ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  password: e.target.value,
                }) as any)
              }
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Captcha solver
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.captcha_solver}
              onChange={(e) => setForm((prev) => ({ ...prev, captcha_solver: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Solver URL
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.solver_url}
              onChange={(e) => setForm((prev) => ({ ...prev, solver_url: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task YesCaptcha key
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.yescaptcha_key}
              onChange={(e) => setForm((prev) => ({ ...prev, yescaptcha_key: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task MoeMail URL
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.moemail_api_url}
              onChange={(e) => setForm((prev) => ({ ...prev, moemail_api_url: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task MoeMail Key
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.moemail_api_key}
              onChange={(e) => setForm((prev) => ({ ...prev, moemail_api_key: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task SkyMail Base
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.skymail_api_base}
              onChange={(e) => setForm((prev) => ({ ...prev, skymail_api_base: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task SkyMail Token
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.skymail_token}
              onChange={(e) => setForm((prev) => ({ ...prev, skymail_token: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task SkyMail Domain
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.skymail_domain}
              onChange={(e) => setForm((prev) => ({ ...prev, skymail_domain: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task LuckMail Base
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.luckmail_base_url}
              onChange={(e) => setForm((prev) => ({ ...prev, luckmail_base_url: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task LuckMail Key
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.luckmail_api_key}
              onChange={(e) => setForm((prev) => ({ ...prev, luckmail_api_key: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task LuckMail Type
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.luckmail_email_type}
              onChange={(e) => setForm((prev) => ({ ...prev, luckmail_email_type: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task LuckMail Domain
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.luckmail_domain}
              onChange={(e) => setForm((prev) => ({ ...prev, luckmail_domain: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task CPA URL
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.cpa_api_url}
              onChange={(e) => setForm((prev) => ({ ...prev, cpa_api_url: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task CPA Key
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.cpa_api_key}
              onChange={(e) => setForm((prev) => ({ ...prev, cpa_api_key: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task Sub2API URL
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.sub2api_api_url}
              onChange={(e) => setForm((prev) => ({ ...prev, sub2api_api_url: e.target.value }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Task Sub2API Key
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.sub2api_api_key}
              onChange={(e) => setForm((prev) => ({ ...prev, sub2api_api_key: e.target.value }))}
            />
          </label>
          <label className="text-sm md:col-span-2">
            Task Sub2API Group IDs
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={form.sub2api_group_ids}
              onChange={(e) => setForm((prev) => ({ ...prev, sub2api_group_ids: e.target.value }))}
            />
          </label>
        </div>
        <button
          onClick={startRegisterTask}
          disabled={!canStartTask}
          className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
        >
          Start Register Task
        </button>
      </div> : null}

      {activeTab === 'schedules' ? <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Scheduled Tasks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Interval type
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              value={scheduleForm.interval_type}
              onChange={(e) =>
                setScheduleForm((prev) => ({ ...prev, interval_type: e.target.value }))
              }
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
            </select>
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Interval value
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              type="number"
              min={1}
              value={scheduleForm.interval_value}
              onChange={(e) =>
                setScheduleForm((prev) => ({
                  ...prev,
                  interval_value: Number(e.target.value || 1),
                }))
              }
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={createSchedule}
            disabled={!canStartTask || scheduleLoading}
            className="px-4 py-2 rounded bg-violet-600 text-white disabled:opacity-50"
          >
            Create Scheduled Task
          </button>
          <button
            onClick={() => loadScheduledTasks().catch(() => null)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
          >
            Refresh
          </button>
        </div>
        <div className="overflow-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'var(--bg-surface-2)' }}>
              <tr>
                <th className="px-2 py-1 text-left">Task ID</th>
                <th className="px-2 py-1 text-left">Platform</th>
                <th className="px-2 py-1 text-left">Interval</th>
                <th className="px-2 py-1 text-left">Paused</th>
                <th className="px-2 py-1 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduledTasks.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-center" style={{ color: 'var(--text-muted)' }} colSpan={5}>
                    No scheduled tasks.
                  </td>
                </tr>
              ) : (
                scheduledTasks.map((item) => (
                  <tr key={item.task_id} className="border-t">
                    <td className="px-2 py-1 font-mono">{item.task_id}</td>
                    <td className="px-2 py-1">{item.platform}</td>
                    <td className="px-2 py-1">
                      {item.interval_value} {item.interval_type}
                    </td>
                    <td className="px-2 py-1">{item.paused ? 'yes' : 'no'}</td>
                    <td className="px-2 py-1 flex gap-1">
                      <button
                        onClick={() => runScheduleNow(item.task_id)}
                        className="px-2 py-1 rounded bg-indigo-600 text-white"
                      >
                        Run now
                      </button>
                      <button
                        onClick={() => toggleSchedule(item.task_id)}
                        className="px-2 py-1 rounded bg-amber-600 text-white"
                      >
                        Toggle
                      </button>
                      <button
                        onClick={() => deleteSchedule(item.task_id)}
                        className="px-2 py-1 rounded bg-red-600 text-white"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div> : null}

      {activeTab === 'tasks' ? <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Task Monitor</h2>
        {!task ? (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No active register task.</div>
        ) : (
          <>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Task ID: {task.id}</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Status: {task.status}</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Progress: {task.progress}</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Success: {task.success ?? 0}</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Skipped: {task.skipped ?? 0}</div>
            <div className="max-h-64 overflow-auto bg-gray-50 border rounded p-2 text-xs">
              {(task.logs || []).slice(-60).map((line, idx) => (
                <div key={`${idx}-${line}`}>{line}</div>
              ))}
            </div>
            {task.errors && task.errors.length > 0 ? (
              <div className="text-sm text-red-600">{task.errors.join(' | ')}</div>
            ) : null}
          </>
        )}
      </div> : null}

      {activeTab === 'tasks' ? <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Runtime Tasks</h2>
        <button
          onClick={() => loadTaskList().catch(() => null)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
        >
          Refresh
        </button>
        <div className="overflow-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'var(--bg-surface-2)' }}>
              <tr>
                <th className="px-2 py-1 text-left">ID</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-left">Progress</th>
                <th className="px-2 py-1 text-left">Success</th>
              </tr>
            </thead>
            <tbody>
              {taskList.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-center" style={{ color: 'var(--text-muted)' }} colSpan={4}>
                    No runtime tasks.
                  </td>
                </tr>
              ) : (
                taskList.slice(0, 50).map((item) => (
                  <tr
                    key={item.id}
                    className="border-t cursor-pointer hover:bg-gray-50"
                    onClick={() => setTask(item)}
                  >
                    <td className="px-2 py-1 font-mono">{item.id}</td>
                    <td className="px-2 py-1">{item.status}</td>
                    <td className="px-2 py-1">{item.progress}</td>
                    <td className="px-2 py-1">{item.success ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div> : null}

      {activeTab === 'tasks' ? <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Task History</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="IDs to delete, e.g. 11,12,13"
            value={selectedLogIds}
            onChange={(e) => setSelectedLogIds(e.target.value)}
          />
          <button
            onClick={batchDeleteLogs}
            className="px-3 py-1 rounded bg-red-600 text-white"
          >
            Delete IDs
          </button>
          <button
            onClick={() => loadTaskLogs().catch(() => null)}
            className="px-3 py-1 rounded-lg text-xs transition-colors" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
          >
            Refresh
          </button>
        </div>
        <div className="overflow-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'var(--bg-surface-2)' }}>
              <tr>
                <th className="px-2 py-1 text-left">ID</th>
                <th className="px-2 py-1 text-left">Platform</th>
                <th className="px-2 py-1 text-left">Email</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {taskLogs.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-center" style={{ color: 'var(--text-muted)' }} colSpan={5}>
                    No task logs.
                  </td>
                </tr>
              ) : (
                taskLogs.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-2 py-1">{item.id}</td>
                    <td className="px-2 py-1">{item.platform}</td>
                    <td className="px-2 py-1">{item.email || '-'}</td>
                    <td className="px-2 py-1">{item.status}</td>
                    <td className="px-2 py-1 text-red-600">{item.error || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div> : null}

      {activeTab === 'proxies' ? <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Proxy Pool</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="http://user:pass@host:port"
            value={proxyForm.url}
            onChange={(e) => setProxyForm((prev) => ({ ...prev, url: e.target.value }))}
          />
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="region (optional)"
            value={proxyForm.region}
            onChange={(e) => setProxyForm((prev) => ({ ...prev, region: e.target.value }))}
          />
          <button onClick={addProxy} className="px-3 py-1 rounded bg-emerald-600 text-white">
            Add Proxy
          </button>
        </div>
        <textarea
          className="w-full border rounded px-2 py-1 text-sm min-h-24"
          placeholder="Bulk add proxies (one per line)"
          value={proxyForm.bulkText}
          onChange={(e) => setProxyForm((prev) => ({ ...prev, bulkText: e.target.value }))}
        />
        <div className="flex gap-2">
          <button
            onClick={bulkAddProxies}
            className="px-3 py-1 rounded bg-teal-600 text-white"
          >
            Bulk Add
          </button>
          <button
            onClick={() => loadProxies().catch(() => null)}
            className="px-3 py-1 rounded-lg text-xs transition-colors" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
          >
            Refresh
          </button>
          <button
            onClick={checkAllProxies}
            className="px-3 py-1 rounded bg-indigo-600 text-white"
          >
            Check Proxies
          </button>
        </div>
        <div className="overflow-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'var(--bg-surface-2)' }}>
              <tr>
                <th className="px-2 py-1 text-left">ID</th>
                <th className="px-2 py-1 text-left">URL</th>
                <th className="px-2 py-1 text-left">Region</th>
                <th className="px-2 py-1 text-left">Active</th>
                <th className="px-2 py-1 text-left">Stats</th>
                <th className="px-2 py-1 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proxies.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-center" style={{ color: 'var(--text-muted)' }} colSpan={6}>
                    No proxies.
                  </td>
                </tr>
              ) : (
                proxies.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-2 py-1">{item.id}</td>
                    <td className="px-2 py-1 font-mono">{item.url}</td>
                    <td className="px-2 py-1">{item.region || '-'}</td>
                    <td className="px-2 py-1">{item.is_active ? 'yes' : 'no'}</td>
                    <td className="px-2 py-1">
                      {item.success_count ?? 0}/{item.fail_count ?? 0}
                    </td>
                    <td className="px-2 py-1 flex gap-1">
                      <button
                        onClick={() => toggleProxy(item.id)}
                        className="px-2 py-1 rounded bg-amber-600 text-white"
                      >
                        Toggle
                      </button>
                      <button
                        onClick={() => deleteProxy(item.id)}
                        className="px-2 py-1 rounded bg-red-600 text-white"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div> : null}

      {activeTab === 'accounts' ? <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Accounts (AutoReg)</h2>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Total: {accountStats?.total ?? 0} | By platform:{' '}
          {accountStats ? Object.entries(accountStats.by_platform).map(([k, v]) => `${k}:${v}`).join(', ') : '-'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="platform"
            value={accountFilters.platform}
            onChange={(e) => setAccountFilters((prev) => ({ ...prev, platform: e.target.value }))}
          />
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="status"
            value={accountFilters.status}
            onChange={(e) => setAccountFilters((prev) => ({ ...prev, status: e.target.value }))}
          />
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="email contains..."
            value={accountFilters.email}
            onChange={(e) => setAccountFilters((prev) => ({ ...prev, email: e.target.value }))}
          />
          <button
            onClick={() => loadAccounts().catch(() => null)}
            className="px-3 py-1 rounded-lg text-xs transition-colors" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
          >
            Refresh
          </button>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="Account IDs to delete, e.g. 10,12,14"
            value={selectedAccountIds}
            onChange={(e) => setSelectedAccountIds(e.target.value)}
          />
          <button
            onClick={batchDeleteAccounts}
            className="px-3 py-1 rounded bg-red-600 text-white"
          >
            Batch Delete
          </button>
          <button onClick={checkAllAccounts} className="px-3 py-1 rounded bg-blue-600 text-white">
            Check All
          </button>
          <button onClick={exportAccounts} className="px-3 py-1 rounded bg-emerald-600 text-white">
            Export CSV
          </button>
        </div>
        <div className="overflow-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'var(--bg-surface-2)' }}>
              <tr>
                <th className="px-2 py-1 text-left">ID</th>
                <th className="px-2 py-1 text-left">Platform</th>
                <th className="px-2 py-1 text-left">Email</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-left">Created</th>
                <th className="px-2 py-1 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td className="px-2 py-2 text-center" style={{ color: 'var(--text-muted)' }} colSpan={6}>
                    No accounts.
                  </td>
                </tr>
              ) : (
                accounts.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-2 py-1">{item.id}</td>
                    <td className="px-2 py-1">{item.platform}</td>
                    <td className="px-2 py-1">{item.email}</td>
                    <td className="px-2 py-1">{item.status}</td>
                    <td className="px-2 py-1">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-2 py-1">
                      <button
                        onClick={() => deleteAccount(item.id)}
                        className="px-2 py-1 rounded bg-red-600 text-white"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div> : null}

      {activeTab === 'integrations' ? (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Integration Services</h2>
            <div className="flex gap-2">
              <button
                onClick={() => runIntegrationAll('start-all')}
                className="px-3 py-1 rounded bg-emerald-600 text-white"
              >
                Start All
              </button>
              <button
                onClick={() => runIntegrationAll('stop-all')}
                className="px-3 py-1 rounded bg-amber-600 text-white"
              >
                Stop All
              </button>
              <button
                onClick={() => loadIntegrationServices().catch(() => null)}
                className="px-3 py-1 rounded-lg text-xs transition-colors" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
              >
                Refresh
              </button>
            </div>
            <div className="overflow-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
              <table className="min-w-full text-sm">
                <thead style={{ backgroundColor: 'var(--bg-surface-2)' }}>
                  <tr>
                    <th className="px-2 py-1 text-left">Name</th>
                    <th className="px-2 py-1 text-left">Installed</th>
                    <th className="px-2 py-1 text-left">Running</th>
                    <th className="px-2 py-1 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {integrationServices.length === 0 ? (
                    <tr>
                      <td className="px-2 py-2 text-center" style={{ color: 'var(--text-muted)' }} colSpan={4}>
                        No services.
                      </td>
                    </tr>
                  ) : (
                    integrationServices.map((svc) => (
                      <tr key={svc.name} className="border-t">
                        <td className="px-2 py-1">{svc.name}</td>
                        <td className="px-2 py-1">{String(Boolean(svc.installed))}</td>
                        <td className="px-2 py-1">{String(Boolean(svc.running))}</td>
                        <td className="px-2 py-1 flex gap-1">
                          <button
                            onClick={() => runIntegrationServiceAction(svc.name, 'install')}
                            className="px-2 py-1 rounded bg-violet-600 text-white"
                          >
                            Install
                          </button>
                          <button
                            onClick={() => runIntegrationServiceAction(svc.name, 'start')}
                            className="px-2 py-1 rounded bg-emerald-600 text-white"
                          >
                            Start
                          </button>
                          <button
                            onClick={() => runIntegrationServiceAction(svc.name, 'stop')}
                            className="px-2 py-1 rounded bg-red-600 text-white"
                          >
                            Stop
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Backfill + Batch Actions</h2>
            <div className="flex gap-2">
              <button
                disabled={integrationLoading}
                onClick={runBackfill}
                className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
              >
                Run Backfill
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                className="border rounded px-2 py-1 text-sm"
                placeholder="platform"
                value={actionPanel.platform}
                onChange={(e) => setActionPanel((prev) => ({ ...prev, platform: e.target.value }))}
              />
              <input
                className="border rounded px-2 py-1 text-sm"
                placeholder="action id"
                value={actionPanel.actionId}
                onChange={(e) => setActionPanel((prev) => ({ ...prev, actionId: e.target.value }))}
              />
              <input
                className="border rounded px-2 py-1 text-sm md:col-span-2"
                placeholder="account ids (comma separated)"
                value={actionPanel.accountIds}
                onChange={(e) => setActionPanel((prev) => ({ ...prev, accountIds: e.target.value }))}
              />
              <textarea
                className="border rounded px-2 py-1 text-sm md:col-span-2 min-h-20"
                placeholder='params JSON, e.g. {"scope":"filtered"}'
                value={actionPanel.paramsJson}
                onChange={(e) => setActionPanel((prev) => ({ ...prev, paramsJson: e.target.value }))}
              />
            </div>
            <button
              onClick={executeBatchAction}
              className="px-3 py-1 rounded bg-indigo-600 text-white"
            >
              Execute Batch Action
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
