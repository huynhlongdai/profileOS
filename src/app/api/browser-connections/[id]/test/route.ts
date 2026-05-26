import { NextResponse } from 'next/server'
import { BrowserConnectionService } from '@/core/services/BrowserConnectionService'

const browserConnectionService = new BrowserConnectionService()

/**
 * POST /api/browser-connections/:id/test - Test GPMLogin API connectivity
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await browserConnectionService.testById(params.id)
    return NextResponse.json({
      success: result.ok,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
