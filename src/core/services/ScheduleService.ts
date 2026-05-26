/**
 * ScheduleService - Quản lý ModuleSchedule
 * 
 * CRUD operations cho ModuleSchedule với hỗ trợ schedule type chi tiết
 */

import { prisma } from '@/lib/prisma'
import type { ModuleSchedule, Prisma } from '@prisma/client'
import { calculateNextRunAt, validateScheduleConfig, type ScheduleConfig } from '../utils/scheduleHelper'

export type ScheduleType = 'interval' | 'daily' | 'weekly'

export interface CreateSchedulePayload {
  moduleName: string
  type: 'check' | 'care'
  scheduleType: ScheduleType
  intervalMin?: number | null
  hour?: number | null
  minute?: number | null
  daysOfWeek?: number[] | null // [0,1,2,3,4,5,6] where 0=Sunday
  accountIds?: string[] | null // Array of account IDs to run, null = all accounts
  profileId?: string | null // Profile ID - null = all accounts of module
  enabled?: boolean
}

export interface UpdateSchedulePayload {
  scheduleType?: ScheduleType
  intervalMin?: number | null
  hour?: number | null
  minute?: number | null
  daysOfWeek?: number[] | null
  accountIds?: string[] | null // Array of account IDs to run, null = all accounts
  profileId?: string | null // Profile ID - null = all accounts of module
  enabled?: boolean
}

export class ScheduleService {
  /**
   * List all schedules với optional filters
   */
  async listSchedules(filter?: {
    moduleName?: string
    type?: string
    enabled?: boolean
  }): Promise<ModuleSchedule[]> {
    const where: Prisma.ModuleScheduleWhereInput = {}
    if (filter?.moduleName) where.moduleName = filter.moduleName
    if (filter?.type) where.type = filter.type
    if (filter?.enabled !== undefined) where.enabled = filter.enabled

    return prisma.moduleSchedule.findMany({
      where,
      orderBy: [
        { moduleName: 'asc' },
        { type: 'asc' },
      ],
    })
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(id: string): Promise<ModuleSchedule | null> {
    return prisma.moduleSchedule.findUnique({
      where: { id },
    })
  }

  /**
   * Create new schedule
   */
  async createSchedule(payload: CreateSchedulePayload): Promise<ModuleSchedule> {
    // Validate config
    const config: ScheduleConfig = {
      scheduleType: payload.scheduleType,
      intervalMin: payload.intervalMin ?? null,
      hour: payload.hour ?? null,
      minute: payload.minute ?? null,
      daysOfWeek: payload.daysOfWeek ?? null,
    }

    const validationError = validateScheduleConfig(config)
    if (validationError) {
      throw new Error(validationError)
    }

    // Calculate nextRunAt
    let nextRunAt: Date | null = null
    if (payload.enabled !== false) {
      try {
        nextRunAt = calculateNextRunAt(config)
      } catch (error) {
        throw new Error(`Failed to calculate nextRunAt: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return prisma.moduleSchedule.create({
      data: {
        moduleName: payload.moduleName,
        type: payload.type,
        scheduleType: payload.scheduleType,
        intervalMin: payload.intervalMin ?? null,
        hour: payload.hour ?? null,
        minute: payload.minute ?? null,
        daysOfWeek: payload.daysOfWeek ? JSON.stringify(payload.daysOfWeek) : null,
        accountIds: payload.accountIds && payload.accountIds.length > 0 ? JSON.stringify(payload.accountIds) : null,
        profileId: payload.profileId || null,
        enabled: payload.enabled !== undefined ? payload.enabled : true,
        nextRunAt,
      },
    })
  }

  /**
   * Update schedule
   */
  async updateSchedule(
    id: string,
    payload: UpdateSchedulePayload
  ): Promise<ModuleSchedule> {
    const existing = await this.getSchedule(id)
    if (!existing) {
      throw new Error('Schedule not found')
    }

    const updateData: Prisma.ModuleScheduleUpdateInput = {}

    // Build config from existing + updates
    const scheduleType = (payload.scheduleType || existing.scheduleType || 'interval') as ScheduleType
    const intervalMin = payload.intervalMin !== undefined ? payload.intervalMin : existing.intervalMin
    const hour = payload.hour !== undefined ? payload.hour : existing.hour
    const minute = payload.minute !== undefined ? payload.minute : existing.minute
    let daysOfWeek: number[] | null = null
    if (payload.daysOfWeek !== undefined) {
      daysOfWeek = payload.daysOfWeek
    } else if (existing.daysOfWeek) {
      try {
        daysOfWeek = JSON.parse(existing.daysOfWeek) as number[]
      } catch {
        daysOfWeek = null
      }
    }

    // Update fields if provided
    if (payload.scheduleType !== undefined) {
      updateData.scheduleType = payload.scheduleType
    }
    if (payload.intervalMin !== undefined) {
      updateData.intervalMin = payload.intervalMin
    }
    if (payload.hour !== undefined) {
      updateData.hour = payload.hour
    }
    if (payload.minute !== undefined) {
      updateData.minute = payload.minute
    }
    if (payload.daysOfWeek !== undefined) {
      updateData.daysOfWeek = payload.daysOfWeek ? JSON.stringify(payload.daysOfWeek) : null
    }
    if (payload.accountIds !== undefined) {
      updateData.accountIds = payload.accountIds && payload.accountIds.length > 0 ? JSON.stringify(payload.accountIds) : null
    }
    if (payload.profileId !== undefined) {
      updateData.profileId = payload.profileId || null
    }

    // Validate config
    const config: ScheduleConfig = {
      scheduleType,
      intervalMin: intervalMin ?? null,
      hour: hour ?? null,
      minute: minute ?? null,
      daysOfWeek,
    }

    const validationError = validateScheduleConfig(config)
    if (validationError) {
      throw new Error(validationError)
    }

    // Recalculate nextRunAt if enabled
    if (payload.enabled !== undefined) {
      updateData.enabled = payload.enabled
    }

    const isEnabled = payload.enabled !== undefined ? payload.enabled : existing.enabled

    if (isEnabled) {
      try {
        const lastRunAt = existing.lastRunAt || null
        updateData.nextRunAt = calculateNextRunAt(config, lastRunAt)
      } catch (error) {
        throw new Error(`Failed to calculate nextRunAt: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else {
      updateData.nextRunAt = null
    }

    return prisma.moduleSchedule.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    await prisma.moduleSchedule.delete({
      where: { id },
    })
  }
}
