import 'dotenv/config'

const PROFILEOS_URL = process.env.PROFILEOS_URL || 'http://localhost:3000'
const AGENT_SECRET = process.env.AGENT_SECRET || ''
const GPMLOGIN_API_URL = process.env.GPMLOGIN_API_URL || 'http://127.0.0.1:19995'
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000')

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

    if (actions.type === 'instruction') {
      console.log(`[Agent] Instruction: ${actions.instruction}`)
      // TODO: Implement instruction execution with GPMLogin API
      // For now, mark as completed
      await updateTask(task.id, {
        status: 'completed',
        resultJson: JSON.stringify({ message: 'Instruction received', instruction: actions.instruction }),
      })
      return
    }

    // Execute GPMLogin operations
    if (actions.type === 'start_profile') {
      const gpmRes = await fetch(`${GPMLOGIN_API_URL}/api/v3/profiles/start/${actions.profileUid}`)
      const gpmData = await gpmRes.json()
      await updateTask(task.id, {
        status: gpmData.success ? 'completed' : 'failed',
        resultJson: JSON.stringify(gpmData),
        error: gpmData.success ? undefined : (gpmData.message || 'Failed to start profile'),
      })
      return
    }

    if (actions.type === 'stop_profile') {
      const gpmRes = await fetch(`${GPMLOGIN_API_URL}/api/v3/profiles/close/${actions.profileUid}`)
      const gpmData = await gpmRes.json()
      await updateTask(task.id, {
        status: gpmData.success ? 'completed' : 'failed',
        resultJson: JSON.stringify(gpmData),
      })
      return
    }

    // Default: mark as completed
    await updateTask(task.id, {
      status: 'completed',
      resultJson: JSON.stringify({ message: 'Task processed' }),
    })
  } catch (error) {
    console.error(`[Agent] Task ${task.id} failed:`, error)
    await updateTask(task.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function reportStatus() {
  try {
    await fetch(`${PROFILEOS_URL}/api/agent/status`, {
      method: 'GET',
      headers,
    })
  } catch {
    // Silently ignore status report failures
  }
}

async function pollLoop() {
  console.log(`[Agent] Started. Polling ${PROFILEOS_URL} every ${POLL_INTERVAL}ms`)
  console.log(`[Agent] GPMLogin API: ${GPMLOGIN_API_URL}`)

  while (true) {
    const tasks = await fetchTasks()

    if (tasks.length > 0) {
      console.log(`[Agent] Found ${tasks.length} pending task(s)`)
      for (const task of tasks) {
        await executeTask(task)
      }
    }

    await reportStatus()
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
  }
}

pollLoop().catch(console.error)
