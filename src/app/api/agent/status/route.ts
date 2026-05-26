import { NextRequest, NextResponse } from 'next/server'
import { validateAgentAuth } from '@/lib/agent/auth'
import { prisma } from '@/lib/prisma'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agent/status - Get system status including agent connection
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
      heartbeat,
    ] = await Promise.all([
      prisma.automationExecution.count({ where: { status: 'pending' } }),
      prisma.automationExecution.count({ where: { status: 'running' } }),
      prisma.profile.count(),
      prisma.profile.count({ where: { status: 'running' } }),
      prisma.account.count(),
      prisma.agentHeartbeat.findFirst({ where: { id: 'default' } }),
    ])

    const isAgentOnline = heartbeat
      ? (Date.now() - heartbeat.lastSeen.getTime()) < 30000
      : false

    return NextResponse.json({
      success: true,
      server: {
        isVercel: config.app.isVercel,
        isProduction: config.app.isProduction,
      },
      agent: {
        isOnline: isAgentOnline,
        lastSeen: heartbeat?.lastSeen || null,
        version: heartbeat?.agentVersion || null,
        providers: heartbeat?.providers ? JSON.parse(heartbeat.providers) : [],
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

/**
 * POST /api/agent/status - Agent heartbeat
 */
export async function POST(req: NextRequest) {
  if (!validateAgentAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { version, providers, metadata } = body

    await prisma.agentHeartbeat.upsert({
      where: { id: 'default' },
      update: {
        lastSeen: new Date(),
        isOnline: true,
        agentVersion: version || '1.0',
        providers: providers ? JSON.stringify(providers) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
      create: {
        id: 'default',
        lastSeen: new Date(),
        isOnline: true,
        agentVersion: version || '1.0',
        providers: providers ? JSON.stringify(providers) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
