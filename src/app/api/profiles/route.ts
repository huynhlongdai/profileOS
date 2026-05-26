import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/core/services/ProfileService'

const profileService = new ProfileService()

/**
 * GET /api/profiles - List profiles
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined
    const groupId = searchParams.get('groupId') || undefined
    const browserType = searchParams.get('browserType') || undefined
    const browserConnectionId = searchParams.get('browserConnectionId') || undefined
    const accountType = searchParams.get('accountType') || undefined

    // DEBUG: Log API parameters
    console.log('[API /api/profiles] GET request with params:', {
      status,
      search,
      groupId,
      browserType,
      accountType,
      browserConnectionId,
    })

    const profiles = await profileService.listProfiles({ status, search, groupId, browserType, accountType, browserConnectionId })

    return NextResponse.json({
      success: true,
      profiles,
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
 * POST /api/profiles - Create new profile
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const profile = await profileService.createProfile({
      name: body.name,
      proxyId: body.proxyId || null,
      autoResetIp: body.autoResetIp || false,
      groupId: body.groupId,
      browserType: body.browserType || 'gpm',
      browserProvider: body.browserProvider || 'gpmlogin',
      browserConnectionId: body.browserConnectionId,
      executablePath: body.executablePath || null,
    })

    return NextResponse.json({
      success: true,
      profile,
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


