import { NextRequest, NextResponse } from 'next/server'
import { ChangeHistoryService } from '@/core/services/ChangeHistoryService'

const changeHistoryService = new ChangeHistoryService()

/**
 * DELETE /api/accounts/:id/change-history/:historyId - Delete a specific change history record
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; historyId: string } }
) {
  try {
    await changeHistoryService.deleteAccountChangeHistoryById(params.historyId)

    return NextResponse.json({
      success: true,
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

