import { NextRequest, NextResponse } from 'next/server'
import { validateAgentAuth } from '@/lib/agent/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/agent/tasks/[id] - Update task status (agent reports progress/completion)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateAgentAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { status, resultJson, error: errorMsg, logsJson } = body

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (resultJson) updateData.resultJson = resultJson
    if (errorMsg) updateData.error = errorMsg
    if (logsJson) updateData.logsJson = logsJson

    if (status === 'running' && !updateData.startedAt) {
      updateData.startedAt = new Date()
    }
    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date()
    }

    const task = await prisma.automationExecution.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({ success: true, task })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
