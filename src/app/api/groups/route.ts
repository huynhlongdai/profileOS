import { NextRequest, NextResponse } from 'next/server'
import { BrowserConnectionService } from '@/core/services/BrowserConnectionService'
import { GpmLoginAdapter } from '@/integrations/GpmLoginAdapter'

async function getDefaultGpmAdapter(): Promise<GpmLoginAdapter> {
  const service = new BrowserConnectionService()
  const conn = await service.getDefaultForProvider('gpmlogin')
  if (conn) {
    return new GpmLoginAdapter(conn.apiUrl, conn.apiVersion)
  }
  return new GpmLoginAdapter()
}

/**
 * GET /api/groups - Get list of groups from GPMLogin
 */
export async function GET(request: NextRequest) {
  try {
    const gpmAdapter = await getDefaultGpmAdapter()
    const groups = await gpmAdapter.getGroups()

    return NextResponse.json({
      success: true,
      groups,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        groups: [],
      },
      { status: 500 }
    )
  }
}

