/**
 * API Route: ModuleSchedule by ID
 * GET /api/schedules/:id - Get schedule
 * PATCH /api/schedules/:id - Update schedule
 * DELETE /api/schedules/:id - Delete schedule
 */

import { NextRequest, NextResponse } from 'next/server'
import { ScheduleService } from '@/core/services/ScheduleService'

const scheduleService = new ScheduleService()

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const schedule = await scheduleService.getSchedule(params.id)

    if (!schedule) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schedule not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      schedule,
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const {
      scheduleType,
      intervalMin,
      hour,
      minute,
      daysOfWeek,
      accountIds,
      profileId,
      enabled,
    } = body

    // Validate at least one field is provided
    if (
      scheduleType === undefined &&
      intervalMin === undefined &&
      hour === undefined &&
      minute === undefined &&
      daysOfWeek === undefined &&
      accountIds === undefined &&
      profileId === undefined &&
      enabled === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one field must be provided',
        },
        { status: 400 }
      )
    }

    // Validate scheduleType if provided
    if (scheduleType !== undefined && !['interval', 'daily', 'weekly'].includes(scheduleType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'scheduleType must be "interval", "daily", or "weekly"',
        },
        { status: 400 }
      )
    }

    const schedule = await scheduleService.updateSchedule(params.id, {
      scheduleType,
      intervalMin: intervalMin !== undefined ? intervalMin : undefined,
      hour: hour !== undefined ? hour : undefined,
      minute: minute !== undefined ? minute : undefined,
      daysOfWeek: daysOfWeek !== undefined ? daysOfWeek : undefined,
      accountIds: accountIds !== undefined ? accountIds : undefined,
      profileId: profileId !== undefined ? profileId : undefined,
      enabled,
    })

    return NextResponse.json({
      success: true,
      schedule,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Schedule not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'Schedule not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await scheduleService.deleteSchedule(params.id)

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted',
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
