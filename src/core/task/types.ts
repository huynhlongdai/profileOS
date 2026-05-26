/**
 * Task Engine Types - Core types for task queue system
 * Used by TaskService and SchedulerService
 */

export type TaskType = 'check' | 'care'

export interface TaskItem {
  id: string
  type: TaskType
  accountId: string
  createdAt: Date
  priority: number // Số càng lớn càng ưu tiên
}

export interface TaskEngineConfig {
  maxConcurrentTasks: number // Số tasks được phép chạy song song
}

