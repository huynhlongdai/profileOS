import { NextResponse } from 'next/server'
import { initPlugins } from '@/lib/init-plugins'

/**
 * Initialize plugins (call this once at startup)
 * GET /api/init
 */
export async function GET() {
  try {
    initPlugins()
    return NextResponse.json({
      success: true,
      message: 'Plugins initialized',
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

