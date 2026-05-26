import { NextRequest, NextResponse } from 'next/server'
import { ChangeHistoryService } from '@/core/services/ChangeHistoryService'

const changeHistoryService = new ChangeHistoryService()

/**
 * GET /api/profiles/:id/change-history - Get change history for a profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const changeType = searchParams.get('changeType') as any

    const result = await changeHistoryService.getProfileChangeHistory(params.id, {
      limit,
      offset,
      changeType,
    })

    return NextResponse.json({
      success: true,
      ...result,
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

/**
 * DELETE /api/profiles/:id/change-history - Delete change history for a profile
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}))
    const { changeType, beforeDate } = body

    const deletedCount = await changeHistoryService.deleteProfileChangeHistory(params.id, {
      changeType,
      beforeDate: beforeDate ? new Date(beforeDate) : undefined,
    })

    return NextResponse.json({
      success: true,
      deletedCount,
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

