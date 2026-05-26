import { NextRequest, NextResponse } from 'next/server'
import { validateAgentAuth } from '@/lib/agent/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agent/tasks - Poll pending tasks for the local agent
 * Agent polls this endpoint to get work to execute
 */
export async function GET(req: NextRequest) {
  if (!validateAgentAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tasks = await prisma.automationExecution.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    })

    return NextResponse.json({ success: true, tasks })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/agent/tasks - Create a new task for the agent
 * Used by the dashboard or AI to queue work
 */
export async function POST(req: NextRequest) {
  if (!validateAgentAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { profileId, templateId, actionsJson, variablesJson } = body

    if (!profileId || !actionsJson) {
      return NextResponse.json(
        { success: false, error: 'profileId and actionsJson are required' },
        { status: 400 }
      )
    }

    const task = await prisma.automationExecution.create({
      data: {
        profileId,
        templateId: templateId || null,
        actionsJson,
        variablesJson: variablesJson || null,
        status: 'pending',
      },
    })

    return NextResponse.json({ success: true, task })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
