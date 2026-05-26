/**
 * API Route: ModuleSchedule CRUD
 * GET /api/schedules - List schedules
 * POST /api/schedules - Create schedule
 */

import { NextRequest, NextResponse } from 'next/server'
import { ScheduleService } from '@/core/services/ScheduleService'

const scheduleService = new ScheduleService()

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const moduleName = searchParams.get('moduleName') || undefined
    const type = searchParams.get('type') || undefined
    const enabled = searchParams.get('enabled')
      ? searchParams.get('enabled') === 'true'
      : undefined

    const schedules = await scheduleService.listSchedules({
      moduleName,
      type,
      enabled,
    })

    return NextResponse.json({
      success: true,
      schedules,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      moduleName,
      type,
      scheduleType,
      intervalMin,
      hour,
      minute,
      daysOfWeek,
      accountIds,
      profileId,
      enabled,
    } = body

    // Validate required fields
    if (!moduleName || !type || !scheduleType) {
      return NextResponse.json(
        {
          success: false,
          error: 'moduleName, type, and scheduleType are required',
        },
        { status: 400 }
      )
    }

    // Validate type
    if (type !== 'check' && type !== 'care') {
      return NextResponse.json(
        {
          success: false,
          error: 'type must be either "check" or "care"',
        },
        { status: 400 }
      )
    }

    // Validate scheduleType
    if (!['interval', 'daily', 'weekly'].includes(scheduleType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'scheduleType must be "interval", "daily", or "weekly"',
        },
        { status: 400 }
      )
    }

    const schedule = await scheduleService.createSchedule({
      moduleName,
      type,
      scheduleType,
      intervalMin: intervalMin ?? null,
      hour: hour ?? null,
      minute: minute ?? null,
      daysOfWeek: daysOfWeek ?? null,
      accountIds: accountIds ?? null,
      profileId: profileId ?? null,
      enabled,
    })

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
