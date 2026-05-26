import { NextRequest, NextResponse } from 'next/server'
import { AccountService } from '@/core/services/AccountService'

const accountService = new AccountService()

/**
 * POST /api/accounts/:id/check - Trigger check for account
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await accountService.triggerCheck(params.id)

    return NextResponse.json({
      success: true,
      message: 'Check triggered',
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

