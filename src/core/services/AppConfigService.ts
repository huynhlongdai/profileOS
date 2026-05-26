/**
 * AppConfigService - Quản lý config chung của ứng dụng
 * 
 * Lưu trữ config dưới dạng key-value trong database (AppConfig model)
 * Hiện tại hỗ trợ TaskEngine config, có thể mở rộng sau
 */

import { prisma } from '@/lib/prisma'
import type { TaskEngineConfig } from '../task/types'

export class AppConfigService {
  /**
   * Lấy raw config JSON từ database
   */
  async getRawConfig(key: string): Promise<string | null> {
    const cfg = await prisma.appConfig.findUnique({
      where: { key },
    })
    return cfg?.valueJson ?? null
  }

  /**
   * Lưu raw config JSON vào database
   */
  async setRawConfig(key: string, valueJson: string): Promise<void> {
    await prisma.appConfig.upsert({
      where: { key },
      update: { valueJson },
      create: { key, valueJson },
    })
  }

  // ========== Task Engine Config ==========

  /**
   * Lấy TaskEngine config với default values
   */
  async getTaskEngineConfig(): Promise<TaskEngineConfig> {
    const raw = await this.getRawConfig('taskEngine')
    if (!raw) {
      // Default config
      return { maxConcurrentTasks: 3 }
    }

    try {
      const parsed = JSON.parse(raw)
      return {
        maxConcurrentTasks:
          typeof parsed.maxConcurrentTasks === 'number' && parsed.maxConcurrentTasks > 0
            ? parsed.maxConcurrentTasks
            : 3,
      }
    } catch {
      // Nếu parse lỗi, trả về default
      return { maxConcurrentTasks: 3 }
    }
  }

  /**
   * Lưu TaskEngine config
   */
  async setTaskEngineConfig(config: TaskEngineConfig): Promise<void> {
    const valueJson = JSON.stringify(config)
    await this.setRawConfig('taskEngine', valueJson)
  }
}

