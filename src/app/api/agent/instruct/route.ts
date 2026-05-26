import { NextRequest, NextResponse } from 'next/server'
import { validateAgentAuth } from '@/lib/agent/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/agent/instruct - Send natural language instruction to agent
 * 
 * This endpoint accepts high-level instructions and converts them into
 * actionable tasks for the local agent to execute.
 * 
 * Examples:
 *   { "instruction": "Check all Gmail accounts", "profileIds": ["..."] }
 *   { "instruction": "Login and claim CoinGecko candy for all accounts" }
 *   { "instruction": "Reset proxy IP for profile X and start browser" }
 */
export async function POST(req: NextRequest) {
  if (!validateAgentAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { instruction, profileIds, accountIds, priority } = body

    if (!instruction) {
      return NextResponse.json(
        { success: false, error: 'instruction is required' },
        { status: 400 }
      )
    }

    // Store the instruction as a pending agent task
    const agentTask = await prisma.automationExecution.create({
      data: {
        profileId: profileIds?.[0] || 'system',
        actionsJson: JSON.stringify({
          type: 'instruction',
          instruction,
          profileIds: profileIds || [],
          accountIds: accountIds || [],
          priority: priority || 0,
        }),
        status: 'pending',
      },
    })

    return NextResponse.json({
      success: true,
      taskId: agentTask.id,
      message: `Instruction queued: "${instruction}"`,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
