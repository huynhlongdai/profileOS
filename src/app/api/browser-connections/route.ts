import { NextRequest, NextResponse } from 'next/server'
import { BrowserConnectionService } from '@/core/services/BrowserConnectionService'

const browserConnectionService = new BrowserConnectionService()

/**
 * GET /api/browser-connections - List all browser connections
 */
export async function GET() {
  try {
    const connections = await browserConnectionService.list()
    return NextResponse.json({ success: true, connections })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/browser-connections - Create a new browser connection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, apiUrl, apiVersion, providerType, description, isDefault } = body

    if (!name || !apiUrl) {
      return NextResponse.json({ success: false, error: 'Name and API URL are required' }, { status: 400 })
    }

    const connection = await browserConnectionService.create({
      name,
      apiUrl,
      apiVersion,
      providerType,
      description,
      isDefault,
    })

    return NextResponse.json({ success: true, connection })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
