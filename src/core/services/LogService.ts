import type { Log, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logEmitter } from '@/lib/log-emitter'

export class LogService {
  /**
   * Log an info message
   */
  async logInfo(module: string, message: string, meta?: Record<string, any>, accountId?: string): Promise<Log> {
    const log = await prisma.log.create({
      data: {
        module,
        type: 'info',
        message,
        metaJson: meta ? JSON.stringify(meta) : null,
        accountId: accountId || null,
      },
    })
    logEmitter.emitLog(log)
    return log
  }

  /**
   * Log an error message
   */
  async logError(module: string, message: string, meta?: Record<string, any>, accountId?: string): Promise<Log> {
    const log = await prisma.log.create({
      data: {
        module,
        type: 'error',
        message,
        metaJson: meta ? JSON.stringify(meta) : null,
        accountId: accountId || null,
      },
    })
    logEmitter.emitLog(log)
    return log
  }

  /**
   * Log a warning message
   */
  async logWarning(module: string, message: string, meta?: Record<string, any>, accountId?: string): Promise<Log> {
    const log = await prisma.log.create({
      data: {
        module,
        type: 'warning',
        message,
        metaJson: meta ? JSON.stringify(meta) : null,
        accountId: accountId || null,
      },
    })
    logEmitter.emitLog(log)
    return log
  }

  /**
   * List logs with filters
   */
  async listLogs(filter: {
    accountId?: string
    module?: string
    type?: string
    from?: Date
    to?: Date
    page?: number
    limit?: number
  }): Promise<{ logs: Log[]; total: number }> {
    const page = filter.page || 1
    const limit = filter.limit || 100
    const skip = (page - 1) * limit

    const where: Prisma.LogWhereInput = {}
    if (filter.accountId) where.accountId = filter.accountId
    if (filter.module) where.module = filter.module
    if (filter.type) where.type = filter.type
    if (filter.from || filter.to) {
      where.createdAt = {}
      if (filter.from) where.createdAt.gte = filter.from
      if (filter.to) where.createdAt.lte = filter.to
    }

    const [logs, total] = await Promise.all([
      prisma.log.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          account: {
            select: {
              id: true,
              label: true,
              identifier: true,
            },
          },
        },
      }),
      prisma.log.count({ where }),
    ])

    return { logs, total }
  }
}

