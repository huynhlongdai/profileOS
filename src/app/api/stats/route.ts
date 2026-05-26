import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/stats - Get dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    const [accounts, proxies, profiles, logs, accountTypes, browserTypes, executions] = await Promise.all([
      prisma.account.groupBy({
        by: ['status'],
        _count: true,
      }).catch(() => []),
      prisma.proxy.groupBy({
        by: ['status'],
        _count: true,
      }).catch(() => []),
      prisma.profile.groupBy({
        by: ['status'],
        _count: true,
      }).catch(() => []),
      prisma.log.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }).catch(() => 0),
      // New stats
      prisma.account.groupBy({
        by: ['accountType'],
        _count: true,
      }).catch(() => []),
      prisma.profile.groupBy({
        by: ['browserType'],
        _count: true,
      }).catch(() => []),
      prisma.automationExecution.groupBy({
        by: ['status'],
        _count: true,
      }).catch(() => []),
    ])

    const accountStats = {
      total: accounts.reduce((sum, a) => sum + a._count, 0),
      active: accounts.find((a) => a.status === 'active')?._count || 0,
      logged_out: accounts.find((a) => a.status === 'logged_out')?._count || 0,
      error: accounts.find((a) => a.status === 'error')?._count || 0,
      banned: accounts.find((a) => a.status === 'banned')?._count || 0,
      proxy_error: accounts.find((a) => a.status === 'proxy_error')?._count || 0,
      byType: accountTypes.reduce((acc, t) => {
        acc[t.accountType] = t._count
        return acc
      }, {} as Record<string, number>),
    }

    const proxyStats = {
      total: proxies.reduce((sum, p) => sum + p._count, 0),
      active: proxies.find((p) => p.status === 'active')?._count || 0,
      dead: proxies.find((p) => p.status === 'dead')?._count || 0,
      checking: proxies.find((p) => p.status === 'checking')?._count || 0,
      error: proxies.find((p) => p.status === 'error')?._count || 0,
    }

    const profileStats = {
      total: profiles.reduce((sum, p) => sum + p._count, 0),
      running: profiles.find((p) => p.status === 'running')?._count || 0,
      idle: profiles.find((p) => p.status === 'idle')?._count || 0,
      starting: profiles.find((p) => p.status === 'starting')?._count || 0,
      stopping: profiles.find((p) => p.status === 'stopping')?._count || 0,
      error: profiles.find((p) => p.status === 'error')?._count || 0,
      byBrowser: browserTypes.reduce((acc, t) => {
        const type = t.browserType || 'unknown'
        acc[type] = t._count
        return acc
      }, {} as Record<string, number>),
    }

    const executionStats = {
      total: executions.reduce((sum, e) => sum + e._count, 0),
      pending: executions.find((e) => e.status === 'pending')?._count || 0,
      running: executions.find((e) => e.status === 'running')?._count || 0,
      completed: executions.find((e) => e.status === 'completed')?._count || 0,
      failed: executions.find((e) => e.status === 'failed')?._count || 0,
      cancelled: executions.find((e) => e.status === 'cancelled')?._count || 0,
    }

    const now = new Date()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Fetch inactive accounts
    const inactiveAccounts = await prisma.account.findMany({
      where: {
        status: { notIn: ['banned', 'error'] }, // Don't flag banned/error as simply inactive
        OR: [
          { lastCare: { lt: fourteenDaysAgo } },
          { lastLogin: { lt: fourteenDaysAgo } },
          { lastCare: null, lastLogin: null, createdAt: { lt: fourteenDaysAgo } }
        ]
      },
      select: {
        id: true,
        label: true,
        accountType: true,
        lastCare: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc', // Oldest first
      },
      take: 10,
    }).catch(() => [])

    // Fetch dead/error resources
    const deadProxies = await prisma.proxy.findMany({
      where: { status: { in: ['dead', 'error'] } },
      select: { id: true, label: true, rawProxy: true, status: true },
      take: 10,
    }).catch(() => [])
    
    const bannedAccounts = await prisma.account.findMany({
      where: { status: { in: ['banned', 'error', 'proxy_error'] } },
      select: { id: true, label: true, accountType: true, status: true },
      take: 10,
    }).catch(() => [])

    // For timeline: 7 parallel counts for the last 7 days
    const timelinePromises = Array.from({ length: 7 }).map((_, i) => {
      const dateStart = new Date(now)
      dateStart.setDate(dateStart.getDate() - (6 - i))
      dateStart.setHours(0, 0, 0, 0)
      
      const dateEnd = new Date(dateStart)
      dateEnd.setDate(dateEnd.getDate() + 1)
      
      return prisma.log.count({
        where: { createdAt: { gte: dateStart, lt: dateEnd } }
      }).then(count => ({
        date: dateStart.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' }),
        count
      })).catch(() => ({ date: dateStart.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' }), count: 0 }))
    })

    const timeline = await Promise.all(timelinePromises)

    return NextResponse.json({
      success: true,
      stats: {
        accounts: accountStats,
        proxies: proxyStats,
        profiles: profileStats,
        executions: executionStats,
        logs24h: logs,
        timeline,
        inactiveAccounts,
        deadProxies,
        bannedAccounts,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

