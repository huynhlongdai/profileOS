/**
 * TaskService - Core Task Engine (Queue + Concurrency + Priority)
 * 
 * Quản lý hàng đợi tasks với:
 * - In-memory queue (có thể thay bằng BullMQ sau)
 * - Priority queue (priority cao → chạy trước)
 * - Concurrency limit (maxConcurrentTasks)
 * - Hỗ trợ check/care cho tất cả plugins
 */

import type { TaskItem, TaskType, TaskEngineConfig } from '../task/types'
import { AccountService } from './AccountService'
import { AppConfigService } from './AppConfigService'
import { LogService } from './LogService'

interface EnqueueOptions {
  priority?: number // Priority càng lớn càng ưu tiên (mặc định: 0)
}

export interface TaskStatus {
  id: string
  type: TaskType
  accountId: string
  createdAt: Date
  priority: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  startedAt?: Date
  completedAt?: Date
  error?: string
}

export class TaskService {
  private queue: TaskItem[] = []
  private processing = false
  private runningCount = 0
  private runningTasks = new Map<string, TaskItem>() // taskId -> task
  private completedTasks = new Map<string, TaskStatus>() // taskId -> status
  private config: TaskEngineConfig = {
    maxConcurrentTasks: 3,
  }

  constructor(
    private accountService: AccountService,
    private appConfigService: AppConfigService,
    private logService: LogService
  ) {
    // Load config async, không blocking constructor
    this.loadConfig().catch((err) => {
      console.error('[TaskService] Failed to load task engine config:', err)
    })
  }

  /**
   * Load config từ AppConfigService
   */
  private async loadConfig() {
    try {
      this.config = await this.appConfigService.getTaskEngineConfig()
      console.log(`[TaskService] Config loaded: maxConcurrentTasks=${this.config.maxConcurrentTasks}`)
    } catch (err) {
      console.error('[TaskService] Error loading config:', err)
    }
  }

  /**
   * Reload config từ database (public method để có thể gọi từ bên ngoài)
   */
  async reloadConfig() {
    await this.loadConfig()
  }

  // ========= Public API ==========

  /**
   * Enqueue check tasks cho nhiều accounts
   */
  async enqueueCheck(
    accountIds: string[],
    options?: EnqueueOptions
  ): Promise<void> {
    this.enqueueMany('check', accountIds, options)
  }

  /**
   * Enqueue care tasks cho nhiều accounts
   */
  async enqueueCare(
    accountIds: string[],
    options?: EnqueueOptions
  ): Promise<void> {
    this.enqueueMany('care', accountIds, options)
  }

  // ========= Internal Helpers ==========

  /**
   * Enqueue nhiều tasks cùng lúc
   */
  private enqueueMany(
    type: TaskType,
    accountIds: string[],
    options?: EnqueueOptions
  ) {
    const now = new Date()
    const priority = options?.priority ?? 0

    console.log(`[TaskService] Enqueuing ${accountIds.length} ${type} tasks with priority ${priority}`)

    for (const accountId of accountIds) {
      const item: TaskItem = {
        id: `${now.getTime()}_${accountId}_${type}_${Math.random()
          .toString(36)
          .slice(2)}`,
        type,
        accountId,
        createdAt: now,
        priority,
      }
      this.queue.push(item)
    }

    console.log(`[TaskService] Queue length after enqueue: ${this.queue.length}`)

    // Sắp xếp lại queue theo priority
    this.sortQueue()

    console.log(`[TaskService] Starting queue processing. Queue length: ${this.queue.length}, Running: ${this.runningCount}/${this.config.maxConcurrentTasks}, Processing: ${this.processing}`)

    // Tự động xử lý queue
    this.processQueue().catch((err) => {
      console.error('[TaskService] processQueue error:', err)
      console.error('[TaskService] Error stack:', err instanceof Error ? err.stack : 'No stack')
    })
  }

  /**
   * Sắp xếp queue: priority cao trước, cùng priority thì createdAt cũ trước.
   * Ưu tiên account đẩy vào sớm hơn.
   */
  private sortQueue() {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority // priority lớn hơn → đứng trước
      }
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  }

  /**
   * Vòng lặp xử lý queue với giới hạn concurrency.
   * - Không block event loop (chỉ xử lý từng "đợt" nhỏ).
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      console.log(`[TaskService] processQueue: Already processing, skipping. Queue: ${this.queue.length}, Running: ${this.runningCount}`)
      return
    }

    console.log(`[TaskService] processQueue: Starting. Queue: ${this.queue.length}, Running: ${this.runningCount}, Max: ${this.config.maxConcurrentTasks}`)
    this.processing = true

    try {
      while (
        this.queue.length > 0 &&
        this.runningCount < this.config.maxConcurrentTasks
      ) {
        const task = this.queue.shift()
        if (!task) {
          console.log('[TaskService] processQueue: No task to shift, breaking')
          break
        }

        console.log(`[TaskService] processQueue: Starting task ${task.id} (${task.type}) for account ${task.accountId}`)
        this.runningCount += 1
        this.runningTasks.set(task.id, task)
        console.log(`[TaskService] processQueue: Running count now: ${this.runningCount}`)

        const startedAt = new Date()

        // Run task asynchronously (không await để không block)
        this.runTask(task)
          .then(() => {
            // Task completed successfully
            const completedAt = new Date()
            this.completedTasks.set(task.id, {
              id: task.id,
              type: task.type,
              accountId: task.accountId,
              createdAt: task.createdAt,
              priority: task.priority,
              status: 'completed',
              startedAt,
              completedAt,
            })
          })
          .catch((err) => {
            // Task failed
            const completedAt = new Date()
            this.completedTasks.set(task.id, {
              id: task.id,
              type: task.type,
              accountId: task.accountId,
              createdAt: task.createdAt,
              priority: task.priority,
              status: 'failed',
              startedAt,
              completedAt,
              error: err instanceof Error ? err.message : String(err),
            })
            console.error(`[TaskService] Task ${task.id} error:`, err)
            console.error('[TaskService] Error stack:', err instanceof Error ? err.stack : 'No stack')
          })
          .finally(() => {
            this.runningCount -= 1
            this.runningTasks.delete(task.id)
            console.log(`[TaskService] Task ${task.id} finished. Running count now: ${this.runningCount}, Queue remaining: ${this.queue.length}`)
            
            // Cleanup old tasks periodically
            if (this.completedTasks.size > 2000) {
              this.clearOldTasks(1000)
            }
            
            // Khi 1 task xong, nếu còn task trong queue thì gọi tiếp processQueue
            if (this.queue.length > 0 && this.runningCount < this.config.maxConcurrentTasks) {
              console.log(`[TaskService] Continuing queue processing. Queue: ${this.queue.length}, Running: ${this.runningCount}`)
              this.processing = false // Reset để có thể gọi lại
              this.processQueue().catch((err) => {
                console.error('[TaskService] Recursive processQueue error:', err)
                console.error('[TaskService] Error stack:', err instanceof Error ? err.stack : 'No stack')
              })
            } else {
              console.log(`[TaskService] Queue processing finished. Queue: ${this.queue.length}, Running: ${this.runningCount}`)
              this.processing = false
            }
          })
      }

      if (this.queue.length === 0) {
        console.log('[TaskService] processQueue: Queue is empty, stopping processing')
        this.processing = false
      } else if (this.runningCount >= this.config.maxConcurrentTasks) {
        console.log(`[TaskService] processQueue: Reached max concurrent tasks (${this.runningCount}/${this.config.maxConcurrentTasks}), waiting for tasks to complete`)
        // Không set processing = false, sẽ được set khi task hoàn thành
      }
    } catch (err) {
      console.error('[TaskService] processQueue: Exception caught:', err)
      console.error('[TaskService] Error stack:', err instanceof Error ? err.stack : 'No stack')
      this.processing = false
      throw err
    }
  }

  /**
   * Thực thi 1 task đơn lẻ:
   * - check: gọi AccountService.triggerCheck
   * - care: gọi AccountService.triggerCare
   */
  private async runTask(task: TaskItem): Promise<void> {
    console.log(`[TaskService] runTask: Starting task ${task.id} (${task.type}) for account ${task.accountId}`)
    
    try {
      // Log task start - wrap in try-catch để không fail nếu logService có vấn đề
      try {
        await this.logService.logInfo('task', 'Run task', {
          taskId: task.id,
          type: task.type,
          accountId: task.accountId,
          priority: task.priority,
        })
      } catch (logErr) {
        console.error(`[TaskService] Failed to log task start:`, logErr)
      }

      console.log(`[TaskService] runTask: Calling ${task.type === 'check' ? 'triggerCheck' : 'triggerCare'} for account ${task.accountId}`)

      if (task.type === 'check') {
        await this.accountService.triggerCheck(task.accountId)
      } else {
        await this.accountService.triggerCare(task.accountId)
      }

      console.log(`[TaskService] runTask: Task ${task.id} completed successfully`)

      // Log task completion
      try {
        await this.logService.logInfo('task', 'Task completed', {
          taskId: task.id,
          type: task.type,
          accountId: task.accountId,
        })
      } catch (logErr) {
        console.error(`[TaskService] Failed to log task completion:`, logErr)
      }
    } catch (err) {
      console.error(`[TaskService] runTask: Task ${task.id} failed:`, err)
      console.error('[TaskService] Error stack:', err instanceof Error ? err.stack : 'No stack')
      
      // Log task failure
      try {
        await this.logService.logError('task', 'Task failed', {
          taskId: task.id,
          type: task.type,
          accountId: task.accountId,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        })
      } catch (logErr) {
        console.error(`[TaskService] Failed to log task error:`, logErr)
      }
      
      // Không throw lại để không block queue
      // Lỗi đã được log, có thể retry sau nếu cần
    }
  }

  /**
   * Get queue stats (cho debugging/monitoring)
   */
  getQueueStats() {
    return {
      queueLength: this.queue.length,
      runningCount: this.runningCount,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      isProcessing: this.processing,
    }
  }

  /**
   * Get all tasks (pending + processing + completed + failed)
   */
  getAllTasks(): TaskStatus[] {
    const tasks: TaskStatus[] = []

    // Pending tasks
    for (const task of this.queue) {
      tasks.push({
        id: task.id,
        type: task.type,
        accountId: task.accountId,
        createdAt: task.createdAt,
        priority: task.priority,
        status: 'pending',
      })
    }

    // Processing tasks
    for (const task of this.runningTasks.values()) {
      tasks.push({
        id: task.id,
        type: task.type,
        accountId: task.accountId,
        createdAt: task.createdAt,
        priority: task.priority,
        status: 'processing',
        startedAt: new Date(), // Approximate
      })
    }

    // Completed/Failed tasks
    for (const status of this.completedTasks.values()) {
      tasks.push(status)
    }

    return tasks
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: 'pending' | 'processing' | 'completed' | 'failed'): TaskStatus[] {
    return this.getAllTasks().filter((task) => task.status === status)
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): TaskStatus | null {
    // Check pending
    const pendingTask = this.queue.find((t) => t.id === taskId)
    if (pendingTask) {
      return {
        id: pendingTask.id,
        type: pendingTask.type,
        accountId: pendingTask.accountId,
        createdAt: pendingTask.createdAt,
        priority: pendingTask.priority,
        status: 'pending',
      }
    }

    // Check processing
    const runningTask = this.runningTasks.get(taskId)
    if (runningTask) {
      return {
        id: runningTask.id,
        type: runningTask.type,
        accountId: runningTask.accountId,
        createdAt: runningTask.createdAt,
        priority: runningTask.priority,
        status: 'processing',
        startedAt: new Date(), // Approximate
      }
    }

    // Check completed/failed
    const completedTask = this.completedTasks.get(taskId)
    if (completedTask) {
      return completedTask
    }

    return null
  }

  /**
   * Clear old completed/failed tasks (keep only last N tasks)
   */
  clearOldTasks(keepLast: number = 1000) {
    const allCompleted = Array.from(this.completedTasks.values())
    if (allCompleted.length <= keepLast) {
      return
    }

    // Sort by completedAt descending, keep only last N
    allCompleted.sort((a, b) => {
      const aTime = a.completedAt?.getTime() || 0
      const bTime = b.completedAt?.getTime() || 0
      return bTime - aTime
    })

    const toKeep = allCompleted.slice(0, keepLast)
    const toRemove = allCompleted.slice(keepLast)

    this.completedTasks.clear()
    for (const task of toKeep) {
      this.completedTasks.set(task.id, task)
    }

    console.log(`[TaskService] Cleared ${toRemove.length} old tasks, kept ${toKeep.length}`)
  }
}
