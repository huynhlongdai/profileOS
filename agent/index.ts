import 'dotenv/config'

const PROFILEOS_URL = process.env.PROFILEOS_URL || 'http://localhost:3000'
const AGENT_SECRET = process.env.AGENT_SECRET || ''
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000')

// Browser provider configurations
const BROWSER_PROVIDERS: Record<string, { apiUrl: string; apiVersion: string }> = {
  gpmlogin: {
    apiUrl: process.env.GPMLOGIN_API_URL || 'http://127.0.0.1:19995',
    apiVersion: process.env.GPMLOGIN_API_VERSION || 'v3',
  },
  gpmlogin_global: {
    apiUrl: process.env.GPMGLOBAL_API_URL || 'http://127.0.0.1:9495',
    apiVersion: process.env.GPMGLOBAL_API_VERSION || 'v1',
  },
  chrome: {
    apiUrl: '',
    apiVersion: '',
  },
  firefox: {
    apiUrl: '',
    apiVersion: '',
  },
}

// Chrome/Firefox executable paths (auto-detect or manual)
const CHROME_PATH = process.env.CHROME_PATH || ''
const FIREFOX_PATH = process.env.FIREFOX_PATH || ''

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

// === GPM API Helpers ===

function buildGpmUrl(provider: string, path: string): string {
  const config = BROWSER_PROVIDERS[provider] || BROWSER_PROVIDERS.gpmlogin
  const base = config.apiUrl.replace(/\/+$/, '')
  const version = config.apiVersion
  return version ? `${base}/api/${version}${path}` : `${base}/api${path}`
}

async function gpmStartProfile(provider: string, profileUid: string): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const url = buildGpmUrl(provider, `/profiles/start/${profileUid}`)
    console.log(`[Agent] ${provider}: Starting profile ${profileUid} via ${url}`)
    const res = await fetch(url)
    const data = await res.json()
    return { success: data.success === true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function gpmStopProfile(provider: string, profileUid: string): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const url = buildGpmUrl(provider, `/profiles/close/${profileUid}`)
    console.log(`[Agent] ${provider}: Stopping profile ${profileUid} via ${url}`)
    const res = await fetch(url)
    const data = await res.json()
    return { success: data.success === true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function gpmListProfiles(provider: string): Promise<{ success: boolean; profiles?: Record<string, unknown>[]; error?: string }> {
  try {
    const url = buildGpmUrl(provider, '/profiles?page=1&per_page=100')
    const res = await fetch(url)
    const data = await res.json()
    const profiles = data.data || data.profiles || []
    return { success: true, profiles }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function gpmTestConnection(provider: string): Promise<{ success: boolean; message: string }> {
  try {
    const url = buildGpmUrl(provider, '/profiles?page=1&per_page=1')
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      return { success: true, message: `${provider} connected at ${BROWSER_PROVIDERS[provider]?.apiUrl}` }
    }
    return { success: false, message: `${provider} returned ${res.status}` }
  } catch (error) {
    return { success: false, message: `${provider} not reachable: ${error instanceof Error ? error.message : String(error)}` }
  }
}

// === Local Browser Helpers (Chrome/Firefox) ===

async function localStartBrowser(browserType: 'chrome' | 'firefox', profilePath: string, executablePath?: string): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  const debugPort = 9222 + Math.floor(Math.random() * 1000)

  try {
    if (browserType === 'chrome') {
      const chromePath = executablePath || CHROME_PATH || detectChromePath()
      if (!chromePath) {
        return { success: false, error: 'Chrome executable not found. Set CHROME_PATH env variable.' }
      }
      const cmd = `"${chromePath}" --remote-debugging-port=${debugPort} --user-data-dir="${profilePath}" --no-first-run`
      console.log(`[Agent] Chrome: Starting with debug port ${debugPort}`)
      exec(cmd)
      return { success: true, data: { debugPort, browserType: 'chrome', profilePath } }
    }

    if (browserType === 'firefox') {
      const ffPath = executablePath || FIREFOX_PATH || detectFirefoxPath()
      if (!ffPath) {
        return { success: false, error: 'Firefox executable not found. Set FIREFOX_PATH env variable.' }
      }
      const cmd = `"${ffPath}" --start-debugger-server ${debugPort} -profile "${profilePath}" --no-remote`
      console.log(`[Agent] Firefox: Starting with debug port ${debugPort}`)
      exec(cmd)
      return { success: true, data: { debugPort, browserType: 'firefox', profilePath } }
    }

    return { success: false, error: `Unknown browser type: ${browserType}` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function detectChromePath(): string {
  const { platform } = process
  if (platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  }
  if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  }
  return '/usr/bin/google-chrome'
}

function detectFirefoxPath(): string {
  const { platform } = process
  if (platform === 'win32') {
    return 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
  }
  if (platform === 'darwin') {
    return '/Applications/Firefox.app/Contents/MacOS/firefox'
  }
  return '/usr/bin/firefox'
}

// === Task Execution ===

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

    // Start profile — route to correct provider
    if (actions.type === 'start_profile') {
      if (provider === 'chrome' || provider === 'firefox') {
        const result = await localStartBrowser(provider, actions.profilePath, actions.executablePath)
        await updateTask(task.id, {
          status: result.success ? 'completed' : 'failed',
          resultJson: JSON.stringify(result.data || {}),
          error: result.error,
        })
      } else {
        // GPMLogin or GPMGlobal
        const result = await gpmStartProfile(provider, actions.profileUid)
        await updateTask(task.id, {
          status: result.success ? 'completed' : 'failed',
          resultJson: JSON.stringify(result.data || {}),
          error: result.error,
        })
      }
      return
    }

    // Stop profile
    if (actions.type === 'stop_profile') {
      if (provider === 'chrome' || provider === 'firefox') {
        // For local browsers, we'd need to track the PID — for now just mark done
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

    // List profiles from a provider
    if (actions.type === 'list_profiles') {
      const result = await gpmListProfiles(provider)
      await updateTask(task.id, {
        status: result.success ? 'completed' : 'failed',
        resultJson: JSON.stringify(result.profiles || []),
        error: result.error,
      })
      return
    }

    // Test connection to a provider
    if (actions.type === 'test_connection') {
      const result = await gpmTestConnection(provider)
      await updateTask(task.id, {
        status: result.success ? 'completed' : 'failed',
        resultJson: JSON.stringify(result),
        error: result.success ? undefined : result.message,
      })
      return
    }

    // Default: mark as completed
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

// === Startup ===

async function testProviders() {
  console.log('[Agent] Testing browser provider connections...')
  for (const [name, config] of Object.entries(BROWSER_PROVIDERS)) {
    if (!config.apiUrl) {
      console.log(`[Agent]   ${name}: local browser (no API)`)
      continue
    }
    const result = await gpmTestConnection(name)
    console.log(`[Agent]   ${name}: ${result.success ? '✓' : '✗'} ${result.message}`)
  }
}

async function pollLoop() {
  console.log(`[Agent] ProfileOS Local Agent v1.1`)
  console.log(`[Agent] Server: ${PROFILEOS_URL}`)
  console.log(`[Agent] Poll interval: ${POLL_INTERVAL}ms`)
  console.log(`[Agent] Providers:`)
  for (const [name, config] of Object.entries(BROWSER_PROVIDERS)) {
    if (config.apiUrl) {
      console.log(`[Agent]   ${name}: ${config.apiUrl} (API ${config.apiVersion || 'default'})`)
    } else {
      console.log(`[Agent]   ${name}: local browser`)
    }
  }
  console.log('')

  await testProviders()
  console.log('')

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

pollLoop().catch(console.error)
