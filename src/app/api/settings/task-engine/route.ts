/**
 * API Route: Task Engine Configuration
 * GET /api/settings/task-engine - Get TaskEngine config
 * PATCH /api/settings/task-engine - Update TaskEngine config
 */

import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

export async function GET() {
  try {
    const config = await core.services.appConfigService.getTaskEngineConfig()

    return NextResponse.json({
      success: true,
      config,
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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { maxConcurrentTasks } = body

    // Validate
    if (typeof maxConcurrentTasks !== 'number' || maxConcurrentTasks < 1 || maxConcurrentTasks > 50) {
      return NextResponse.json(
        {
          success: false,
          error: 'maxConcurrentTasks must be a number between 1 and 50',
        },
        { status: 400 }
      )
    }

    await core.services.appConfigService.setTaskEngineConfig({
      maxConcurrentTasks,
    })

    // Reload config in TaskService
    await core.services.taskService.reloadConfig()

    return NextResponse.json({
      success: true,
      message: 'Task engine config updated',
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

