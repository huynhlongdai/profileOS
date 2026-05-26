import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

/**
 * POST /api/accounts/check-bulk - Bulk check accounts
 * 
 * Uses TaskService from core bootstrap for queue management
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const accountIds: string[] = body.accountIds || []

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'accountIds must be a non-empty array' },
        { status: 400 }
      )
    }

    await core.services.taskService.enqueueCheck(accountIds)

    return NextResponse.json({
      success: true,
      count: accountIds.length,
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

