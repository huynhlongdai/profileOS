import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/schedules/[id]/runs - Get scheduler runs for a specific schedule
 * 
 * Query params:
 * - limit: Number of results (default: 50, max: 200)
 * - offset: Pagination offset (default: 0)
 * - status: Filter by status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = req.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    // Verify schedule exists
    const schedule = await prisma.moduleSchedule.findUnique({
      where: { id: params.id },
    })

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const where: any = {
      scheduleId: params.id,
    }

    if (status) {
      where.status = status
    }

    const [runs, total] = await Promise.all([
      prisma.schedulerRun.findMany({
        where,
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
    console.error('Error fetching schedule runs:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

