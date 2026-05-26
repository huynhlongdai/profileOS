import { NextRequest, NextResponse } from 'next/server'
import { BrowserConnectionService } from '@/core/services/BrowserConnectionService'

const browserConnectionService = new BrowserConnectionService()

/**
 * POST /api/browser-connections/test - Test arbitrary API URL config
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiUrl, apiVersion } = body
    if (!apiUrl) {
      return NextResponse.json({ success: false, error: 'apiUrl is required' }, { status: 400 })
    }
    const result = await browserConnectionService.testConfig(apiUrl, apiVersion || 'v3')
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
