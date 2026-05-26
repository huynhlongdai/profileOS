import fs from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { config } from '@/lib/config'

type AutoRegStatus = {
  running: boolean
  pid: number | null
  startedAt: number | null
  baseUrl: string
  projectPath: string
  logFile: string
}

class AutoRegProcessManager {
  private child: ChildProcess | null = null
  private startedAt: number | null = null
  private readonly baseUrl = config.autoReg.baseUrl
  private readonly projectPath = path.resolve(process.cwd(), 'auto_reg')
  private readonly logFile = path.resolve(process.cwd(), 'active_log.txt')

  getStatus(): AutoRegStatus {
    return {
      running: Boolean(this.child && !this.child.killed),
      pid: this.child?.pid ?? null,
      startedAt: this.startedAt,
      baseUrl: this.baseUrl,
      projectPath: this.projectPath,
      logFile: this.logFile,
    }
  }

  async start(): Promise<AutoRegStatus> {
    if (this.child && !this.child.killed) {
      return this.getStatus()
    }

    if (!fs.existsSync(this.projectPath)) {
      throw new Error(`auto_reg not found at: ${this.projectPath}`)
    }

    const pythonCmd = process.env.AUTO_REG_PYTHON_CMD || 'python'
    const args = ['main.py']

    const logStream = fs.createWriteStream(this.logFile, { flags: 'a' })
    const child = spawn(pythonCmd, args, {
      cwd: this.projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })

    child.stdout?.on('data', (chunk) => {
      logStream.write(`[auto_reg][stdout] ${chunk}`)
    })
    child.stderr?.on('data', (chunk) => {
      logStream.write(`[auto_reg][stderr] ${chunk}`)
    })
    child.on('exit', () => {
      this.child = null
      this.startedAt = null
    })

    this.child = child
    this.startedAt = Date.now()
    return this.getStatus()
  }

  stop(): AutoRegStatus {
    if (this.child && !this.child.killed) {
      this.child.kill()
    }
    this.child = null
    this.startedAt = null
    return this.getStatus()
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __autoRegManager: AutoRegProcessManager | undefined
}

export const autoRegManager = globalThis.__autoRegManager || new AutoRegProcessManager()
if (!globalThis.__autoRegManager) {
  globalThis.__autoRegManager = autoRegManager
}

export async function autoRegFetch<T>(
  endpoint: string,
  init?: RequestInit,
): Promise<T> {
  const status = autoRegManager.getStatus()
  const url = `${status.baseUrl}${endpoint}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `AutoReg error ${res.status}`)
  }
  return data as T
}

export function autoRegBaseUrl(): string {
  return autoRegManager.getStatus().baseUrl
}
