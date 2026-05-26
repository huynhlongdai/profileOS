import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

/**
 * GET /api/tasks - List all tasks
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as
      | 'pending'
      | 'processing'
      | 'completed'
      | 'failed'
      | undefined

    const taskService = core.services.taskService
    let tasks = taskService.getAllTasks()

    if (status) {
      tasks = taskService.getTasksByStatus(status)
    }

    // Sort by createdAt descending
    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return NextResponse.json({
      success: true,
      tasks,
      stats: taskService.getQueueStats(),
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

