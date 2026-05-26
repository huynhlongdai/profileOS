import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/core/services/ProfileService'

const profileService = new ProfileService()

/**
 * POST /api/profiles/sync - Sync profiles from GPMLogin
 * Query params:
 *   - browserType: Optional filter to sync only profiles of specific browser type ('chromium' | 'firefox' | 'gpm')
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const browserType = searchParams.get('browserType') as 'chromium' | 'firefox' | 'gpm' | null
    const connectionId = searchParams.get('connectionId') || undefined
    const browserProvider = searchParams.get('browserProvider') || undefined
    
    const result = await profileService.syncProfilesFromGpm(undefined, connectionId, browserProvider)

    return NextResponse.json({
      success: true,
      message: `Synced ${result.synced} new profiles from ${result.total} total`,
      synced: result.synced,
      total: result.total,
      browserType: browserType || 'all',
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

