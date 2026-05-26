import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/scheduler-runs - List scheduler run history
 * 
 * Query params:
 * - scheduleId: Filter by schedule ID
 * - status: Filter by status (running | completed | failed | skipped)
 * - limit: Number of results (default: 50, max: 200)
 * - offset: Pagination offset (default: 0)
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 */
export async function GET(req: NextRequest) {
  try {
    // Check if schedulerRun model exists in Prisma client
    if (!prisma.schedulerRun) {
      console.error('[API] Prisma client does not have schedulerRun model. Please restart the dev server.')
      return NextResponse.json(
        {
          success: false,
          error: 'SchedulerRun model not available. Please restart the server.',
        },
        { status: 503 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const scheduleId = searchParams.get('scheduleId')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}

    if (scheduleId) {
      where.scheduleId = scheduleId
    }

    if (status) {
      where.status = status
    }

    if (startDate || endDate) {
      where.startedAt = {}
      if (startDate) {
        where.startedAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.startedAt.lte = new Date(endDate)
      }
    }

    const [runs, total] = await Promise.all([
      prisma.schedulerRun.findMany({
        where,
        include: {
          schedule: {
            select: {
              id: true,
              moduleName: true,
              type: true,
              scheduleType: true,
            },
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.schedulerRun.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: runs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('Error fetching scheduler runs:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

