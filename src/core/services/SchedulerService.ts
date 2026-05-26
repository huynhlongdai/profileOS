/**
 * SchedulerService - Lên lịch tự động cho modules
 * 
 * Chạy vòng lặp tick mỗi X giây (mặc định 60s)
 * Kiểm tra ModuleSchedule và tự động enqueue tasks vào TaskService
 */

import { prisma } from '@/lib/prisma'
import { TaskService } from './TaskService'
import { LogService } from './LogService'

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null
  private readonly tickIntervalMs = 60_000 // 1 phút

  constructor(
    private taskService: TaskService,
    private logService: LogService
  ) {}

  /**
   * Khởi động scheduler
   */
  start() {
    if (this.timer) {
      console.log('[SchedulerService] Scheduler is already running')
      return
    }

    console.log('[SchedulerService] Starting scheduler...')
    this.timer = setInterval(() => {
      this.tick().catch((err) =>
        console.error('[SchedulerService] Tick error:', err)
      )
    }, this.tickIntervalMs)

    // Chạy tick ngay lập tức (không đợi interval đầu tiên)
    this.tick().catch((err) =>
      console.error('[SchedulerService] Initial tick error:', err)
    )

    console.log(`[SchedulerService] Scheduler started (tick interval: ${this.tickIntervalMs}ms)`)
  }

  /**
   * Dừng scheduler
   */
  stop() {
    if (!this.timer) {
      console.log('[SchedulerService] Scheduler is not running')
      return
    }

    console.log('[SchedulerService] Stopping scheduler...')
    clearInterval(this.timer)
    this.timer = null
    console.log('[SchedulerService] Scheduler stopped')
  }

  /**
   * Một tick của scheduler: kiểm tra và xử lý schedules
   */
  private async tick() {
    const now = new Date()

    // Tìm các schedule đã đến lúc chạy
    const schedules = await prisma.moduleSchedule.findMany({
      where: {
        enabled: true,
        OR: [
          { nextRunAt: null }, // Chưa có nextRunAt
          { nextRunAt: { lte: now } }, // Đã đến lúc chạy
        ],
      },
    })

    if (schedules.length === 0) {
      return
    }

    await this.logService.logInfo('scheduler', `Scheduler tick: found ${schedules.length} schedules to process`, {
      scheduleCount: schedules.length,
    })
    console.log(`[SchedulerService] Found ${schedules.length} schedules to process`)

    for (const sch of schedules) {
      let schedulerRunId: string | null = null
      const startedAt = new Date()

      try {
        // Tạo SchedulerRun record để lưu lịch sử
        const schedulerRun = await prisma.schedulerRun.create({
          data: {
            scheduleId: sch.id,
            status: 'running',
            accountsEnqueued: 0,
            startedAt,
          },
        })
        schedulerRunId = schedulerRun.id

        await this.logService.logInfo('scheduler', 'Schedule run started', {
          scheduleId: sch.id,
          runId: schedulerRunId,
          moduleName: sch.moduleName,
          type: sch.type,
        })

        // Xử lý schedule và lấy số accounts được enqueue
        const accountsEnqueued = await this.handleSchedule(sch)

        // Calculate nextRunAt based on schedule type
        const { calculateNextRunAt } = await import('../utils/scheduleHelper')
        
        let daysOfWeek: number[] | null = null
        if (sch.daysOfWeek) {
          try {
            daysOfWeek = JSON.parse(sch.daysOfWeek) as number[]
          } catch {
            daysOfWeek = null
          }
        }

        const nextRunAt = calculateNextRunAt(
          {
            scheduleType: (sch.scheduleType || 'interval') as 'interval' | 'daily' | 'weekly',
            intervalMin: sch.intervalMin,
            hour: sch.hour,
            minute: sch.minute,
            daysOfWeek,
          },
          now
        )

        const completedAt = new Date()
        const durationMs = completedAt.getTime() - startedAt.getTime()

        // Update lastRunAt và nextRunAt
        await prisma.moduleSchedule.update({
          where: { id: sch.id },
          data: {
            lastRunAt: now,
            nextRunAt,
          },
        })

        // Update SchedulerRun với kết quả thành công
        if (schedulerRunId) {
          await prisma.schedulerRun.update({
            where: { id: schedulerRunId },
            data: {
              status: 'completed',
              accountsEnqueued,
              completedAt,
              durationMs,
            },
          })
        }

        await this.logService.logInfo('scheduler', 'Schedule run completed', {
          scheduleId: sch.id,
          runId: schedulerRunId,
          moduleName: sch.moduleName,
          type: sch.type,
          accountsEnqueued,
          durationMs,
          nextRunAt: nextRunAt.toISOString(),
        })

        console.log(
          `[SchedulerService] Schedule processed: ${sch.moduleName}:${sch.type}, enqueued ${accountsEnqueued} accounts, next run: ${nextRunAt.toISOString()}`
        )
      } catch (err) {
        const completedAt = new Date()
        const durationMs = completedAt.getTime() - startedAt.getTime()
        const errorMessage = err instanceof Error ? err.message : String(err)

        // Update SchedulerRun với kết quả lỗi
        if (schedulerRunId) {
          try {
            await prisma.schedulerRun.update({
              where: { id: schedulerRunId },
              data: {
                status: 'failed',
                completedAt,
                durationMs,
                errorMessage,
              },
            })
          } catch (updateError) {
            console.error('[SchedulerService] Failed to update scheduler run:', updateError)
          }
        }

        await this.logService.logError('scheduler', 'Schedule run failed', {
          scheduleId: sch.id,
          runId: schedulerRunId,
          moduleName: sch.moduleName,
          type: sch.type,
          error: errorMessage,
          durationMs,
        })
        console.error(`[SchedulerService] Error processing schedule ${sch.id}:`, err)
      }
    }
  }

  /**
   * Xử lý 1 schedule cụ thể:
   * - Hiện tại chỉ implement cho moduleName = 'gmail', type = 'care' | 'check'
   * - Sau này có thể mở rộng thêm cho module khác
   * @returns Số accounts đã được enqueue
   */
  private async handleSchedule(sch: {
    id: string
    moduleName: string
    type: string
    intervalMin: number | null
    accountIds: string | null // JSON array string or null
    profileId: string | null // Profile ID or null
  }): Promise<number> {
    // Parse accountIds if provided
    let selectedAccountIds: string[] | null = null
    if (sch.accountIds) {
      try {
        selectedAccountIds = JSON.parse(sch.accountIds) as string[]
        if (!Array.isArray(selectedAccountIds) || selectedAccountIds.length === 0) {
          selectedAccountIds = null
        }
      } catch {
        selectedAccountIds = null
      }
    }

    if (sch.moduleName === 'gmail') {
      if (sch.type === 'care') {
        return await this.enqueueGmailCareBatch(selectedAccountIds, sch.profileId)
      } else if (sch.type === 'check') {
        return await this.enqueueGmailCheckBatch(selectedAccountIds, sch.profileId)
      }
      return 0
    }

    // TODO: schedules cho module khác (outlook, facebook, ...)
    await this.logService.logInfo(
      'scheduler',
      'Schedule found but no handler implemented',
      {
        scheduleId: sch.id,
        moduleName: sch.moduleName,
        type: sch.type,
      }
    )
    return 0
  }

  /**
   * Lấy danh sách account Gmail cần care và đẩy vào TaskService.
   * Rule:
   *  - Nếu có selectedAccountIds: chỉ enqueue những accounts đó
   *  - Nếu có profileId: chỉ lấy accounts của profile đó
   *  - Nếu không: lọc accountType = 'gmail', sort theo lastCare asc, take 200
   * @param selectedAccountIds Array of account IDs to enqueue, null = all accounts
   * @param profileId Profile ID to filter by, null = all profiles
   * @returns Số accounts đã được enqueue
   */
  private async enqueueGmailCareBatch(selectedAccountIds: string[] | null = null, profileId: string | null = null): Promise<number> {
    let accounts: Array<{ id: string; status: string }> = []

    if (selectedAccountIds && selectedAccountIds.length > 0) {
      // Chỉ enqueue các accounts được chọn
      const where: any = {
        id: { in: selectedAccountIds },
        accountType: 'gmail',
      }
      if (profileId) {
        where.gpmloginProfileId = profileId
      }

      accounts = await prisma.account.findMany({
        where,
        select: {
          id: true,
          status: true,
        },
      })

      await this.logService.logInfo('scheduler', 'Enqueue gmail care batch with selected accounts', {
        selectedCount: selectedAccountIds.length,
        foundCount: accounts.length,
        profileId: profileId || 'all',
        accountIds: selectedAccountIds.slice(0, 10), // Log first 10 IDs only
      })
    } else {
      // Lấy accounts theo profile hoặc tất cả
      const where: any = { accountType: 'gmail' }
      if (profileId) {
        where.gpmloginProfileId = profileId
      }

      accounts = await prisma.account.findMany({
        where,
        orderBy: {
          lastCare: 'asc', // null sẽ đứng đầu (chưa care bao giờ)
        },
        take: 200, // TODO: có thể chuyển vào config
        select: {
          id: true,
          status: true,
        },
      })

      await this.logService.logInfo('scheduler', 'Enqueue gmail care batch', {
        count: accounts.length,
        profileId: profileId || 'all',
      })
    }

    const ids = accounts.map((a) => a.id)
    if (ids.length === 0) {
      await this.logService.logInfo('scheduler', 'No Gmail accounts to care', {
        hasSelection: selectedAccountIds !== null && selectedAccountIds.length > 0,
      })
      console.log('[SchedulerService] No Gmail accounts to care')
      return 0
    }

    // Tính priority dựa trên status (error > logged_out > active)
    const priorityMap: Record<string, number> = {
      error: 10,
      logged_out: 5,
      active: 0,
    }

    for (const account of accounts) {
      const priority = priorityMap[account.status] || 0
      await this.taskService.enqueueCare([account.id], { priority })
    }

    await this.logService.logInfo('scheduler', 'Enqueue gmail care batch', {
      count: ids.length,
      accountIds: ids.slice(0, 10), // Log first 10 IDs only
      hasSelection: selectedAccountIds !== null && selectedAccountIds.length > 0,
    })

    console.log(`[SchedulerService] Enqueued ${ids.length} Gmail accounts for care`)
    return ids.length
  }

  /**
   * Lấy danh sách account Gmail cần check và đẩy vào TaskService.
   * Rule:
   *  - Nếu có selectedAccountIds: chỉ enqueue những accounts đó
   *  - Nếu có profileId: chỉ lấy accounts của profile đó
   *  - Nếu không: lọc accountType = 'gmail', sort theo lastCheck asc, take 200
   * @param selectedAccountIds Array of account IDs to enqueue, null = all accounts
   * @param profileId Profile ID to filter by, null = all profiles
   * @returns Số accounts đã được enqueue
   */
  private async enqueueGmailCheckBatch(selectedAccountIds: string[] | null = null, profileId: string | null = null): Promise<number> {
    let accounts: Array<{ id: string; status: string }> = []

    if (selectedAccountIds && selectedAccountIds.length > 0) {
      // Chỉ enqueue các accounts được chọn
      const where: any = {
        id: { in: selectedAccountIds },
        accountType: 'gmail',
      }
      if (profileId) {
        where.gpmloginProfileId = profileId
      }

      accounts = await prisma.account.findMany({
        where,
        select: {
          id: true,
          status: true,
        },
      })

      await this.logService.logInfo('scheduler', 'Enqueue gmail check batch with selected accounts', {
        selectedCount: selectedAccountIds.length,
        foundCount: accounts.length,
        profileId: profileId || 'all',
        accountIds: selectedAccountIds.slice(0, 10), // Log first 10 IDs only
      })
    } else {
      // Lấy accounts theo profile hoặc tất cả
      const where: any = { accountType: 'gmail' }
      if (profileId) {
        where.gpmloginProfileId = profileId
      }

      accounts = await prisma.account.findMany({
        where,
        orderBy: {
          lastCheck: 'asc', // null sẽ đứng đầu (chưa check bao giờ)
        },
        take: 200, // TODO: có thể chuyển vào config
        select: {
          id: true,
          status: true,
        },
      })

      await this.logService.logInfo('scheduler', 'Enqueue gmail check batch', {
        count: accounts.length,
        profileId: profileId || 'all',
      })
    }

    const ids = accounts.map((a) => a.id)
    if (ids.length === 0) {
      await this.logService.logInfo('scheduler', 'No Gmail accounts to check', {
        hasSelection: selectedAccountIds !== null && selectedAccountIds.length > 0,
      })
      console.log('[SchedulerService] No Gmail accounts to check')
      return 0
    }

    // Tính priority dựa trên status (error > logged_out > active)
    const priorityMap: Record<string, number> = {
      error: 10,
      logged_out: 5,
      active: 0,
    }

    for (const account of accounts) {
      const priority = priorityMap[account.status] || 0
      await this.taskService.enqueueCheck([account.id], { priority })
    }

    await this.logService.logInfo('scheduler', 'Enqueue gmail check batch', {
      count: ids.length,
      accountIds: ids.slice(0, 10), // Log first 10 IDs only
      hasSelection: selectedAccountIds !== null && selectedAccountIds.length > 0,
    })

    console.log(`[SchedulerService] Enqueued ${ids.length} Gmail accounts for check`)
    return ids.length
  }
}

