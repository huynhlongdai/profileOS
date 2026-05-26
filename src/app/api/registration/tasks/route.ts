import { NextRequest, NextResponse } from 'next/server'
import { RegistrationService } from '@/core/services/RegistrationService'

/**
 * GET /api/registration/tasks - List all registration tasks
 */
export async function GET() {
  try {
    const registrationService = RegistrationService.getInstance()
    const tasks = await registrationService.listTasks()
    return NextResponse.json({ success: true, tasks })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/registration/tasks - Start a new registration task
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { platform, count, proxy, concurrency, register_delay_seconds, extra } = body

    if (!platform || !count) {
      return NextResponse.json(
        { success: false, error: 'Platform and count are required' },
        { status: 400 }
      )
    }

    const registrationService = RegistrationService.getInstance()
    const result = await registrationService.startTask({
      platform,
      count,
      proxy,
      concurrency,
      register_delay_seconds,
      extra
    })

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to start registration task' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
