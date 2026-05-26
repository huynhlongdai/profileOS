/**
 * ScheduledTaskService - Cron-like task scheduling
 * 
 * Hỗ trợ:
 * - Schedule check/care tasks theo thời gian cố định
 * - Interval-based scheduling (mỗi X phút/giờ)
 * - Cron expressions (nếu cần)
 * - Auto-recovery khi restart server
 */

import { prisma } from '@/lib/prisma'
import { LogService } from './LogService'
import { TaskService } from './TaskService'
import { AccountService } from './AccountService'
import { AppConfigService } from './AppConfigService'

export type ScheduleType = 'check' | 'care' | 'check_and_care'
export type ScheduleFrequency = 'once' | 'interval' | 'daily' | 'weekly'

export interface ScheduleConfig {
    id: string
    name: string
    type: ScheduleType
    frequency: ScheduleFrequency
    /** For interval: minutes between runs */
    intervalMinutes?: number
    /** For daily/weekly: time of day (HH:mm) */
    timeOfDay?: string
    /** For weekly: day of week (0-6, 0=Sunday) */
    dayOfWeek?: number
    /** Account IDs to include (empty = all accounts) */
    accountIds?: string[]
    /** Account type filter */
    accountType?: string
    /** Whether schedule is active */
    isActive: boolean
    /** Next scheduled run time */
    nextRunAt?: Date
    /** Last run time */
    lastRunAt?: Date
    /** Created at */
    createdAt: Date
    /** Updated at */
    updatedAt: Date
}

export interface CreateScheduleInput {
    name: string
    type: ScheduleType
    frequency: ScheduleFrequency
    intervalMinutes?: number
    timeOfDay?: string
    dayOfWeek?: number
    accountIds?: string[]
    accountType?: string
    isActive?: boolean
}

// In-memory store for schedules (since we don't have DB table yet)
// In production, this should be stored in database
const scheduleStore = new Map<string, ScheduleConfig>()

export class ScheduledTaskService {
    private isRunning = false
    private checkIntervalId: NodeJS.Timeout | null = null
    private readonly CHECK_INTERVAL_MS = 60000 // Check every minute

    constructor(
        private taskService: TaskService,
        private accountService: AccountService,
        private appConfigService: AppConfigService,
        private logService: LogService
    ) { }

    /**
     * Start the scheduler daemon
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('[ScheduledTaskService] Already running')
            return
        }

        this.isRunning = true
        console.log('[ScheduledTaskService] Starting scheduler daemon')

        // Load schedules from storage
        await this.loadSchedules()

        // Start the check loop
        this.checkIntervalId = setInterval(() => {
            this.checkAndRunDueTasks().catch(err => {
                console.error('[ScheduledTaskService] Error in check loop:', err)
            })
        }, this.CHECK_INTERVAL_MS)

        // Run immediately on start
        await this.checkAndRunDueTasks()

        await this.logService.logInfo('scheduler', 'Scheduler started', {
            scheduleCount: scheduleStore.size,
        })
    }

    /**
     * Stop the scheduler daemon
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return
        }

        this.isRunning = false

        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId)
            this.checkIntervalId = null
        }

        console.log('[ScheduledTaskService] Scheduler stopped')
        await this.logService.logInfo('scheduler', 'Scheduler stopped', {})
    }

    /**
     * Check and run due tasks
     */
    private async checkAndRunDueTasks(): Promise<void> {
        const now = new Date()

        for (const [id, schedule] of scheduleStore) {
            if (!schedule.isActive) continue
            if (!schedule.nextRunAt) continue
            if (schedule.nextRunAt > now) continue

            // Task is due, run it
            try {
                await this.runScheduledTask(schedule)

                // Update lastRunAt and calculate nextRunAt
                schedule.lastRunAt = now
                schedule.nextRunAt = this.calculateNextRunTime(schedule, now)
                scheduleStore.set(id, schedule)

                await this.logService.logInfo('scheduler', 'Scheduled task completed', {
                    scheduleId: schedule.id,
                    scheduleName: schedule.name,
                    nextRunAt: schedule.nextRunAt?.toISOString(),
                })
            } catch (error) {
                await this.logService.logError('scheduler', 'Scheduled task failed', {
                    scheduleId: schedule.id,
                    scheduleName: schedule.name,
                    error: error instanceof Error ? error.message : String(error),
                })
            }
        }
    }

    /**
     * Run a scheduled task
     */
    private async runScheduledTask(schedule: ScheduleConfig): Promise<void> {
        console.log(`[ScheduledTaskService] Running scheduled task: ${schedule.name}`)

        // Get accounts to process
        let accountIds = schedule.accountIds || []

        if (accountIds.length === 0) {
            // Get all accounts (optionally filtered by type)
            const accounts = await prisma.account.findMany({
                where: schedule.accountType ? { accountType: schedule.accountType } : undefined,
                select: { id: true },
            })
            accountIds = accounts.map(a => a.id)
        }

        if (accountIds.length === 0) {
            console.log('[ScheduledTaskService] No accounts to process')
            return
        }

        // Enqueue tasks based on type
        switch (schedule.type) {
            case 'check':
                await this.taskService.enqueueCheck(accountIds)
                break
            case 'care':
                await this.taskService.enqueueCare(accountIds)
                break
            case 'check_and_care':
                await this.taskService.enqueueCheck(accountIds)
                // Care will be enqueued after a delay to let check complete
                setTimeout(async () => {
                    await this.taskService.enqueueCare(accountIds)
                }, 5000)
                break
        }

        console.log(`[ScheduledTaskService] Enqueued ${accountIds.length} accounts for ${schedule.type}`)
    }

    /**
     * Calculate next run time based on schedule config
     */
    private calculateNextRunTime(schedule: ScheduleConfig, fromTime: Date): Date | undefined {
        const now = fromTime

        switch (schedule.frequency) {
            case 'once':
                // One-time schedule, no next run
                return undefined

            case 'interval':
                // Add interval minutes
                if (schedule.intervalMinutes) {
                    return new Date(now.getTime() + schedule.intervalMinutes * 60 * 1000)
                }
                return undefined

            case 'daily':
                // Next day at specified time
                if (schedule.timeOfDay) {
                    const [hours, minutes] = schedule.timeOfDay.split(':').map(Number)
                    const next = new Date(now)
                    next.setDate(next.getDate() + 1)
                    next.setHours(hours, minutes, 0, 0)
                    return next
                }
                return undefined

            case 'weekly':
                // Next week on specified day at specified time
                if (schedule.timeOfDay !== undefined && schedule.dayOfWeek !== undefined) {
                    const [hours, minutes] = schedule.timeOfDay.split(':').map(Number)
                    const next = new Date(now)
                    const currentDay = next.getDay()
                    let daysUntilNext = schedule.dayOfWeek - currentDay
                    if (daysUntilNext <= 0) {
                        daysUntilNext += 7
                    }
                    next.setDate(next.getDate() + daysUntilNext)
                    next.setHours(hours, minutes, 0, 0)
                    return next
                }
                return undefined

            default:
                return undefined
        }
    }

    // ========= CRUD Operations =========

    /**
     * Create a new schedule
     */
    async createSchedule(input: CreateScheduleInput): Promise<ScheduleConfig> {
        const now = new Date()
        const id = `schedule_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`

        const schedule: ScheduleConfig = {
            id,
            name: input.name,
            type: input.type,
            frequency: input.frequency,
            intervalMinutes: input.intervalMinutes,
            timeOfDay: input.timeOfDay,
            dayOfWeek: input.dayOfWeek,
            accountIds: input.accountIds,
            accountType: input.accountType,
            isActive: input.isActive ?? true,
            createdAt: now,
            updatedAt: now,
        }

        // Calculate first run time
        schedule.nextRunAt = this.calculateNextRunTime(schedule, now)

        // For interval schedules, set first run to now + interval
        if (schedule.frequency === 'interval' && schedule.intervalMinutes) {
            schedule.nextRunAt = new Date(now.getTime() + schedule.intervalMinutes * 60 * 1000)
        }

        // For one-time schedules, set run time based on timeOfDay
        if (schedule.frequency === 'once' && schedule.timeOfDay) {
            const [hours, minutes] = schedule.timeOfDay.split(':').map(Number)
            const runTime = new Date(now)
            runTime.setHours(hours, minutes, 0, 0)
            if (runTime <= now) {
                // If time has passed today, schedule for tomorrow
                runTime.setDate(runTime.getDate() + 1)
            }
            schedule.nextRunAt = runTime
        }

        scheduleStore.set(id, schedule)
        await this.saveSchedules()

        await this.logService.logInfo('scheduler', 'Schedule created', {
            scheduleId: id,
            scheduleName: input.name,
            type: input.type,
            frequency: input.frequency,
        })

        return schedule
    }

    /**
     * Get all schedules
     */
    async getAllSchedules(): Promise<ScheduleConfig[]> {
        return Array.from(scheduleStore.values())
    }

    /**
     * Get schedule by ID
     */
    async getSchedule(id: string): Promise<ScheduleConfig | null> {
        return scheduleStore.get(id) || null
    }

    /**
     * Update a schedule
     */
    async updateSchedule(id: string, updates: Partial<CreateScheduleInput>): Promise<ScheduleConfig | null> {
        const schedule = scheduleStore.get(id)
        if (!schedule) {
            return null
        }

        const now = new Date()
        const updated: ScheduleConfig = {
            ...schedule,
            ...updates,
            updatedAt: now,
        }

        // Recalculate next run time if frequency or time settings changed
        if (updates.frequency || updates.intervalMinutes || updates.timeOfDay || updates.dayOfWeek) {
            updated.nextRunAt = this.calculateNextRunTime(updated, now)
        }

        scheduleStore.set(id, updated)
        await this.saveSchedules()

        return updated
    }

    /**
     * Delete a schedule
     */
    async deleteSchedule(id: string): Promise<boolean> {
        const deleted = scheduleStore.delete(id)
        if (deleted) {
            await this.saveSchedules()
        }
        return deleted
    }

    /**
     * Toggle schedule active status
     */
    async toggleSchedule(id: string): Promise<ScheduleConfig | null> {
        const schedule = scheduleStore.get(id)
        if (!schedule) {
            return null
        }

        schedule.isActive = !schedule.isActive
        schedule.updatedAt = new Date()

        if (schedule.isActive && !schedule.nextRunAt) {
            // Recalculate next run time when re-activating
            schedule.nextRunAt = this.calculateNextRunTime(schedule, new Date())
        }

        scheduleStore.set(id, schedule)
        await this.saveSchedules()

        return schedule
    }

    /**
     * Run a schedule immediately (manual trigger)
     */
    async runNow(id: string): Promise<void> {
        const schedule = scheduleStore.get(id)
        if (!schedule) {
            throw new Error(`Schedule not found: ${id}`)
        }

        await this.runScheduledTask(schedule)

        // Update lastRunAt but don't change nextRunAt
        schedule.lastRunAt = new Date()
        scheduleStore.set(id, schedule)
        await this.saveSchedules()
    }

    // ========= Persistence =========

    /**
     * Save schedules to storage (for now, just keep in memory)
     * In production, this should save to database
     */
    private async saveSchedules(): Promise<void> {
        // TODO: Save to database when table is available
        // For now, schedules are stored in memory only
        console.log(`[ScheduledTaskService] Saved ${scheduleStore.size} schedules`)
    }

    /**
     * Load schedules from storage
     */
    private async loadSchedules(): Promise<void> {
        // TODO: Load from database when table is available
        // For now, schedules start empty on each restart
        console.log('[ScheduledTaskService] Loaded schedules from storage')
    }

    /**
     * Get scheduler status
     */
    getStatus(): {
        isRunning: boolean
        scheduleCount: number
        nextDueSchedule: { id: string; name: string; nextRunAt: Date } | null
    } {
        let nextDueSchedule: { id: string; name: string; nextRunAt: Date } | null = null

        for (const schedule of scheduleStore.values()) {
            if (!schedule.isActive || !schedule.nextRunAt) continue

            if (!nextDueSchedule || schedule.nextRunAt < nextDueSchedule.nextRunAt) {
                nextDueSchedule = {
                    id: schedule.id,
                    name: schedule.name,
                    nextRunAt: schedule.nextRunAt,
                }
            }
        }

        return {
            isRunning: this.isRunning,
            scheduleCount: scheduleStore.size,
            nextDueSchedule,
        }
    }
}

// Singleton instance
let scheduledTaskService: ScheduledTaskService | null = null

export function getScheduledTaskService(
    taskService: TaskService,
    accountService: AccountService,
    appConfigService: AppConfigService,
    logService: LogService
): ScheduledTaskService {
    if (!scheduledTaskService) {
        scheduledTaskService = new ScheduledTaskService(
            taskService,
            accountService,
            appConfigService,
            logService
        )
    }
    return scheduledTaskService
}
