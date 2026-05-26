import 'dotenv/config'

const PROFILEOS_URL = process.env.PROFILEOS_URL || 'http://localhost:3000'
const AGENT_SECRET = process.env.AGENT_SECRET || ''
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000')
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '15000')
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL || '60000')

const BROWSER_PROVIDERS: Record<string, { apiUrl: string; apiVersion: string }> = {
  gpmlogin: {
    apiUrl: process.env.GPMLOGIN_API_URL || 'http://127.0.0.1:19995',
    apiVersion: process.env.GPMLOGIN_API_VERSION || 'v3',
  },
  gpmlogin_global: {
    apiUrl: process.env.GPMGLOBAL_API_URL || 'http://127.0.0.1:9495',
    apiVersion: process.env.GPMGLOBAL_API_VERSION || 'v1',
  },
  chrome: { apiUrl: '', apiVersion: '' },
  firefox: { apiUrl: '', apiVersion: '' },
}

const CHROME_PATH = process.env.CHROME_PATH || ''
const FIREFOX_PATH = process.env.FIREFOX_PATH || ''

const AGENT_VERSION = '1.1'

interface AgentTask {
  id: string
  profileId: string
  actionsJson: string
  status: string
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AGENT_SECRET}`,
}

// === GPM API ===

function buildGpmUrl(provider: string, path: string): string {
  const config = BROWSER_PROVIDERS[provider] || BROWSER_PROVIDERS.gpmlogin
  const base = config.apiUrl.replace(/\/+$/, '')
  const version = config.apiVersion
  return version ? `${base}/api/${version}${path}` : `${base}/api${path}`
}

async function gpmStartProfile(provider: string, profileUid: string) {
  try {
    const url = buildGpmUrl(provider, `/profiles/start/${profileUid}`)
    console.log(`[Agent] ${provider}: Starting profile ${profileUid}`)
    const res = await fetch(url)
    const data = await res.json()
    return { success: data.success === true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function gpmStopProfile(provider: string, profileUid: string) {
  try {
    const url = buildGpmUrl(provider, `/profiles/close/${profileUid}`)
    console.log(`[Agent] ${provider}: Stopping profile ${profileUid}`)
    const res = await fetch(url)
    const data = await res.json()
    return { success: data.success === true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function gpmListProfiles(provider: string) {
  try {
    const url = buildGpmUrl(provider, '/profiles?page=1&per_page=500')
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    const profiles = data.data || data.profiles || []
    return { success: true, profiles }
  } catch (error) {
    return { success: false, profiles: [], error: error instanceof Error ? error.message : String(error) }
  }
}

async function gpmTestConnection(provider: string) {
  try {
    const url = buildGpmUrl(provider, '/profiles?page=1&per_page=1')
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) return { success: true, message: `${provider} connected at ${BROWSER_PROVIDERS[provider]?.apiUrl}` }
    return { success: false, message: `${provider} returned ${res.status}` }
  } catch (error) {
    return { success: false, message: `${provider} not reachable: ${error instanceof Error ? error.message : String(error)}` }
  }
}

// === Local Browser ===

async function localStartBrowser(browserType: 'chrome' | 'firefox', profilePath: string, executablePath?: string) {
  const { exec } = await import('child_process')
  const debugPort = 9222 + Math.floor(Math.random() * 1000)

  try {
    if (browserType === 'chrome') {
      const chromePath = executablePath || CHROME_PATH || detectPath('chrome')
      if (!chromePath) return { success: false, error: 'Chrome not found. Set CHROME_PATH.' }
      exec(`"${chromePath}" --remote-debugging-port=${debugPort} --user-data-dir="${profilePath}" --no-first-run`)
      return { success: true, data: { debugPort, browserType: 'chrome', profilePath } }
    }
    if (browserType === 'firefox') {
      const ffPath = executablePath || FIREFOX_PATH || detectPath('firefox')
      if (!ffPath) return { success: false, error: 'Firefox not found. Set FIREFOX_PATH.' }
      exec(`"${ffPath}" --start-debugger-server ${debugPort} -profile "${profilePath}" --no-remote`)
      return { success: true, data: { debugPort, browserType: 'firefox', profilePath } }
    }
    return { success: false, error: `Unknown browser: ${browserType}` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function detectPath(browser: 'chrome' | 'firefox'): string {
  const p = process.platform
  if (browser === 'chrome') {
    if (p === 'win32') return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    if (p === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    return '/usr/bin/google-chrome'
  }
  if (p === 'win32') return 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
  if (p === 'darwin') return '/Applications/Firefox.app/Contents/MacOS/firefox'
  return '/usr/bin/firefox'
}

// === Server Communication ===

async function fetchTasks(): Promise<AgentTask[]> {
  try {
    const res = await fetch(`${PROFILEOS_URL}/api/agent/tasks`, { headers })
    if (!res.ok) {
      console.error(`[Agent] Failed to fetch tasks: ${res.status}`)
      return []
    }
    const data = await res.json()
    return data.tasks || []
  } catch (error) {
    console.error('[Agent] Error fetching tasks:', error)
    return []
  }
}

async function updateTask(taskId: string, update: Record<string, unknown>) {
  try {
    await fetch(`${PROFILEOS_URL}/api/agent/tasks/${taskId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(update),
    })
  } catch (error) {
    console.error(`[Agent] Error updating task ${taskId}:`, error)
  }
}

async function sendHeartbeat() {
  try {
    const activeProviders = Object.entries(BROWSER_PROVIDERS)
      .filter(([, c]) => c.apiUrl)
      .map(([name]) => name)

    await fetch(`${PROFILEOS_URL}/api/agent/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        version: AGENT_VERSION,
        providers: activeProviders,
        metadata: { pollInterval: POLL_INTERVAL, platform: process.platform },
      }),
    })
  } catch {
    // Silently ignore heartbeat failures
  }
}

async function syncProfiles() {
  for (const [provider, config] of Object.entries(BROWSER_PROVIDERS)) {
    if (!config.apiUrl) continue

    const result = await gpmListProfiles(provider)
    if (!result.success || !result.profiles.length) continue

    try {
      const res = await fetch(`${PROFILEOS_URL}/api/agent/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          profiles: result.profiles,
          provider,
        }),
      })
      const data = await res.json()
      if (data.success) {
        console.log(`[Agent] Synced ${provider}: ${data.synced} new, ${data.updated} updated (${data.total} total)`)
      }
    } catch (error) {
      console.error(`[Agent] Sync error for ${provider}:`, error)
    }
  }
}

// === Task Execution ===

async function executeTask(task: AgentTask) {
  console.log(`[Agent] Executing task ${task.id}`)
  await updateTask(task.id, { status: 'running' })

  try {
    const actions = JSON.parse(task.actionsJson)
    const provider = actions.browserProvider || actions.provider || 'gpmlogin'

    if (actions.type === 'instruction') {
      console.log(`[Agent] Instruction: ${actions.instruction}`)
      await updateTask(task.id, {
        status: 'completed',
        resultJson: JSON.stringify({ message: 'Instruction received', instruction: actions.instruction }),
      })
      return
    }

    if (actions.type === 'start_profile') {
      if (provider === 'chrome' || provider === 'firefox') {
        const result = await localStartBrowser(provider, actions.profilePath, actions.executablePath)
        await updateTask(task.id, {
          status: result.success ? 'completed' : 'failed',
          resultJson: JSON.stringify(result.data || {}),
          error: result.error,
        })
      } else {
        const result = await gpmStartProfile(provider, actions.profileUid)
        await updateTask(task.id, {
          status: result.success ? 'completed' : 'failed',
          resultJson: JSON.stringify(result.data || {}),
          error: result.error,
        })
      }
      return
    }

    if (actions.type === 'stop_profile') {
      if (provider === 'chrome' || provider === 'firefox') {
        await updateTask(task.id, {
          status: 'completed',
          resultJson: JSON.stringify({ message: `${provider} stop not yet implemented` }),
        })
      } else {
        const result = await gpmStopProfile(provider, actions.profileUid)
        await updateTask(task.id, {
          status: result.success ? 'completed' : 'failed',
          resultJson: JSON.stringify(result.data || {}),
          error: result.error,
        })
      }
      return
    }

    if (actions.type === 'sync_profiles') {
      await syncProfiles()
      await updateTask(task.id, {
        status: 'completed',
        resultJson: JSON.stringify({ message: 'Sync completed' }),
      })
      return
    }

    if (actions.type === 'test_connection') {
      const result = await gpmTestConnection(provider)
      await updateTask(task.id, {
        status: result.success ? 'completed' : 'failed',
        resultJson: JSON.stringify(result),
        error: result.success ? undefined : result.message,
      })
      return
    }

    await updateTask(task.id, {
      status: 'completed',
      resultJson: JSON.stringify({ message: 'Task processed', type: actions.type }),
    })
  } catch (error) {
    console.error(`[Agent] Task ${task.id} failed:`, error)
    await updateTask(task.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// === Main Loop ===

async function testProviders() {
  console.log('[Agent] Testing connections...')
  for (const [name, config] of Object.entries(BROWSER_PROVIDERS)) {
    if (!config.apiUrl) {
      console.log(`[Agent]   ${name}: local browser`)
      continue
    }
    const result = await gpmTestConnection(name)
    console.log(`[Agent]   ${name}: ${result.success ? '✓' : '✗'} ${result.message}`)
  }
}

async function main() {
  console.log(`[Agent] ProfileOS Local Agent v${AGENT_VERSION}`)
  console.log(`[Agent] Server: ${PROFILEOS_URL}`)
  console.log(`[Agent] Poll: ${POLL_INTERVAL}ms | Heartbeat: ${HEARTBEAT_INTERVAL}ms | Sync: ${SYNC_INTERVAL}ms`)

  for (const [name, config] of Object.entries(BROWSER_PROVIDERS)) {
    if (config.apiUrl) {
      console.log(`[Agent]   ${name}: ${config.apiUrl} (API ${config.apiVersion || 'default'})`)
    } else {
      console.log(`[Agent]   ${name}: local browser`)
    }
  }

  await testProviders()
  await sendHeartbeat()
  await syncProfiles()

  // Heartbeat loop
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

  // Auto-sync loop
  setInterval(syncProfiles, SYNC_INTERVAL)

  // Task polling loop
  while (true) {
    const tasks = await fetchTasks()
    if (tasks.length > 0) {
      console.log(`[Agent] Found ${tasks.length} pending task(s)`)
      for (const task of tasks) {
        await executeTask(task)
      }
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
  }
}

main().catch(console.error)
