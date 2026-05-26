import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCached, setCache } from '@/lib/cache'

const CACHE_KEY = 'dashboard-stats'
const CACHE_TTL = 10_000 // 10 seconds

export async function GET(request: NextRequest) {
  try {
    const cached = getCached<Record<string, unknown>>(CACHE_KEY)
    if (cached) {
      return NextResponse.json({ success: true, stats: cached })
    }

    const now = new Date()
    const day24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Timeline date ranges
    const timelineRanges = Array.from({ length: 7 }).map((_, i) => {
      const dateStart = new Date(now)
      dateStart.setDate(dateStart.getDate() - (6 - i))
      dateStart.setHours(0, 0, 0, 0)
      const dateEnd = new Date(dateStart)
      dateEnd.setDate(dateEnd.getDate() + 1)
      return { dateStart, dateEnd, label: dateStart.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' }) }
    })

    // ALL queries in one Promise.all — single round of network calls
    const [
      accounts, proxies, profiles, logs, accountTypes, browserTypes, executions,
      inactiveAccounts, deadProxies, bannedAccounts,
      ...timelineCounts
    ] = await Promise.all([
      prisma.account.groupBy({ by: ['status'], _count: true }).catch(() => []),
      prisma.proxy.groupBy({ by: ['status'], _count: true }).catch(() => []),
      prisma.profile.groupBy({ by: ['status'], _count: true }).catch(() => []),
      prisma.log.count({ where: { createdAt: { gte: day24h } } }).catch(() => 0),
      prisma.account.groupBy({ by: ['accountType'], _count: true }).catch(() => []),
      prisma.profile.groupBy({ by: ['browserType'], _count: true }).catch(() => []),
      prisma.automationExecution.groupBy({ by: ['status'], _count: true }).catch(() => []),
      prisma.account.findMany({
        where: {
          status: { notIn: ['banned', 'error'] },
          OR: [
            { lastCare: { lt: fourteenDaysAgo } },
            { lastLogin: { lt: fourteenDaysAgo } },
            { lastCare: null, lastLogin: null, createdAt: { lt: fourteenDaysAgo } }
          ]
        },
        select: { id: true, label: true, accountType: true, lastCare: true, lastLogin: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }).catch(() => []),
      prisma.proxy.findMany({
        where: { status: { in: ['dead', 'error'] } },
        select: { id: true, label: true, rawProxy: true, status: true },
        take: 10,
      }).catch(() => []),
      prisma.account.findMany({
        where: { status: { in: ['banned', 'error', 'proxy_error'] } },
        select: { id: true, label: true, accountType: true, status: true },
        take: 10,
      }).catch(() => []),
      ...timelineRanges.map(({ dateStart, dateEnd, label }) =>
        prisma.log.count({ where: { createdAt: { gte: dateStart, lt: dateEnd } } })
          .then(count => ({ date: label, count }))
          .catch(() => ({ date: label, count: 0 }))
      ),
    ])

    const accountStats = {
      total: accounts.reduce((sum: number, a: { _count: number }) => sum + a._count, 0),
      active: accounts.find((a: { status: string }) => a.status === 'active')?._count || 0,
      logged_out: accounts.find((a: { status: string }) => a.status === 'logged_out')?._count || 0,
      error: accounts.find((a: { status: string }) => a.status === 'error')?._count || 0,
      banned: accounts.find((a: { status: string }) => a.status === 'banned')?._count || 0,
      proxy_error: accounts.find((a: { status: string }) => a.status === 'proxy_error')?._count || 0,
      byType: accountTypes.reduce((acc: Record<string, number>, t: { accountType: string; _count: number }) => {
        acc[t.accountType] = t._count
        return acc
      }, {} as Record<string, number>),
    }

    const proxyStats = {
      total: proxies.reduce((sum: number, p: { _count: number }) => sum + p._count, 0),
      active: proxies.find((p: { status: string }) => p.status === 'active')?._count || 0,
      dead: proxies.find((p: { status: string }) => p.status === 'dead')?._count || 0,
      checking: proxies.find((p: { status: string }) => p.status === 'checking')?._count || 0,
      error: proxies.find((p: { status: string }) => p.status === 'error')?._count || 0,
    }

    const profileStats = {
      total: profiles.reduce((sum: number, p: { _count: number }) => sum + p._count, 0),
      running: profiles.find((p: { status: string }) => p.status === 'running')?._count || 0,
      idle: profiles.find((p: { status: string }) => p.status === 'idle')?._count || 0,
      starting: profiles.find((p: { status: string }) => p.status === 'starting')?._count || 0,
      stopping: profiles.find((p: { status: string }) => p.status === 'stopping')?._count || 0,
      error: profiles.find((p: { status: string }) => p.status === 'error')?._count || 0,
      byBrowser: browserTypes.reduce((acc: Record<string, number>, t: { browserType: string | null; _count: number }) => {
        const type = t.browserType || 'unknown'
        acc[type] = t._count
        return acc
      }, {} as Record<string, number>),
    }

    const executionStats = {
      total: executions.reduce((sum: number, e: { _count: number }) => sum + e._count, 0),
      pending: executions.find((e: { status: string }) => e.status === 'pending')?._count || 0,
      running: executions.find((e: { status: string }) => e.status === 'running')?._count || 0,
      completed: executions.find((e: { status: string }) => e.status === 'completed')?._count || 0,
      failed: executions.find((e: { status: string }) => e.status === 'failed')?._count || 0,
      cancelled: executions.find((e: { status: string }) => e.status === 'cancelled')?._count || 0,
    }

    const stats = {
      accounts: accountStats,
      proxies: proxyStats,
      profiles: profileStats,
      executions: executionStats,
      logs24h: logs,
      timeline: timelineCounts,
      inactiveAccounts,
      deadProxies,
      bannedAccounts,
    }

    setCache(CACHE_KEY, stats, CACHE_TTL)

    return NextResponse.json({ success: true, stats })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
