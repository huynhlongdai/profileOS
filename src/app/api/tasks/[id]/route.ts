import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

/**
 * GET /api/tasks/[id] - Get task by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskService = core.services.taskService
    const task = taskService.getTask(params.id)

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      task,
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

