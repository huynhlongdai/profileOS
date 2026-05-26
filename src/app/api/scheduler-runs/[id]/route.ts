import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/scheduler-runs/[id] - Get a specific scheduler run
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const run = await prisma.schedulerRun.findUnique({
      where: { id: params.id },
      include: {
        schedule: {
          select: {
            id: true,
            moduleName: true,
            type: true,
            scheduleType: true,
            intervalMin: true,
            hour: true,
            minute: true,
            daysOfWeek: true,
          },
        },
      },
    })

    if (!run) {
      return NextResponse.json(
        { success: false, error: 'Scheduler run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: run,
    })
  } catch (error) {
    console.error('Error fetching scheduler run:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

