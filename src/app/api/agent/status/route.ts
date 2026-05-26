import { NextRequest, NextResponse } from 'next/server'
import { validateAgentAuth } from '@/lib/agent/auth'
import { prisma } from '@/lib/prisma'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agent/status - Get system status for agent monitoring
 * POST /api/agent/status - Agent reports its own status (heartbeat)
 */
export async function GET(req: NextRequest) {
  if (!validateAgentAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [
      pendingTasks,
      runningTasks,
      totalProfiles,
      runningProfiles,
      totalAccounts,
    ] = await Promise.all([
      prisma.automationExecution.count({ where: { status: 'pending' } }),
      prisma.automationExecution.count({ where: { status: 'running' } }),
      prisma.profile.count(),
      prisma.profile.count({ where: { status: 'running' } }),
      prisma.account.count(),
    ])

    return NextResponse.json({
      success: true,
      server: {
        isVercel: config.app.isVercel,
        isProduction: config.app.isProduction,
        agentUrl: config.agent.url || null,
      },
      stats: {
        pendingTasks,
        runningTasks,
        totalProfiles,
        runningProfiles,
        totalAccounts,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
