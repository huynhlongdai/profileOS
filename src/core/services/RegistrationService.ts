import fetch from 'node-fetch'
import { prisma } from '@/lib/prisma'
import { LogService } from './LogService'

export interface RegistrationPlatform {
  name: string
  display_name: string
}

export interface RegistrationTask {
  id: string
  status: 'pending' | 'running' | 'done' | 'failed'
  progress: string
  logs: string[]
  success?: number
  errors?: string[]
}

export class RegistrationService {
  private static instance: RegistrationService
  private baseUrl: string = process.env.AUTO_REG_URL || 'http://localhost:8000'
  private logService: LogService

  private constructor() {
    this.logService = new LogService()
  }

  static getInstance(): RegistrationService {
    if (!RegistrationService.instance) {
      RegistrationService.instance = new RegistrationService()
    }
    return RegistrationService.instance
  }

  /**
   * Get list of supported registration platforms
   */
  async listPlatforms(): Promise<RegistrationPlatform[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/platforms`)
      if (!response.ok) throw new Error(`Failed to fetch platforms: ${response.statusText}`)
      return await response.json()
    } catch (error) {
      await this.logService.logError('registration', 'Error listing platforms', { error: String(error) })
      return []
    }
  }

  /**
   * Start a registration task
   */
  async startTask(params: {
    platform: string
    count: number
    proxy?: string
    concurrency?: number
    register_delay_seconds?: number
    extra?: Record<string, any>
  }): Promise<{ task_id: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tasks/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          executor_type: 'protocol',
          captcha_solver: 'yescaptcha',
        }),
      })

      if (!response.ok) throw new Error(`Failed to start registration task: ${response.statusText}`)
      const data = await response.json()
      
      await this.logService.logInfo('registration', `Started registration task for ${params.platform}`, { 
        taskId: data.task_id,
        count: params.count 
      })
      
      return data
    } catch (error) {
      await this.logService.logError('registration', 'Error starting registration task', { error: String(error) })
      return null
    }
  }

  /**
   * Get comprehensive task status
   */
  async getTask(taskId: string): Promise<RegistrationTask | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}`)
      if (!response.ok) return null
      return await response.json()
    } catch (error) {
      return null
    }
  }

  /**
   * List all tasks
   */
  async listTasks(): Promise<RegistrationTask[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tasks`)
      if (!response.ok) return []
      return await response.json()
    } catch (error) {
      return []
    }
  }

  /**
   * Sync accounts from auto_reg to GPMTool database
   */
  async syncAccounts(platform?: string): Promise<{ success: number; skipped: number }> {
    try {
      const url = platform 
        ? `${this.baseUrl}/api/accounts?platform=${platform}&page_size=1000`
        : `${this.baseUrl}/api/accounts?page_size=1000`
        
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch accounts to sync: ${response.statusText}`)
      
      const data = await response.json()
      const regAccounts = data.items || []
      
      let successCount = 0
      let skippedCount = 0

      for (const regAcc of regAccounts) {
        // Check if account already exists
        const existing = await prisma.account.findFirst({
          where: {
            identifier: regAcc.email,
            accountType: regAcc.platform
          }
        })

        if (existing) {
          skippedCount++
          continue
        }

        // Create new account
        await prisma.account.create({
          data: {
            label: regAcc.email.split('@')[0],
            accountType: regAcc.platform,
            identifier: regAcc.email,
            passwordEncrypted: regAcc.password, // We'll store as is for now, encryption can be added later
            status: 'active',
            notes: `Imported from auto_reg on ${new Date().toISOString()}`,
            createdAt: new Date(regAcc.created_at)
          }
        })
        successCount++
      }

      if (successCount > 0) {
        await this.logService.logInfo('registration', `Synced ${successCount} accounts from auto_reg`, { platform })
      }

      return { success: successCount, skipped: skippedCount }
    } catch (error) {
      await this.logService.logError('registration', 'Error syncing accounts', { error: String(error) })
      return { success: 0, skipped: 0 }
    }
  }
}
