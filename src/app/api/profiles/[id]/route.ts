import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/core/services/ProfileService'

const profileService = new ProfileService()

/**
 * GET /api/profiles/:id - Get profile by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const profile = await profileService.getProfile(params.id)

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: 'Profile not found',
        },
        { status: 404 }
      )
    }

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

/**
 * PUT /api/profiles/:id - Update profile
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const profile = await profileService.updateProfile(params.id, {
      name: body.name,
      proxyId: body.proxyId || null,
      groupId: body.groupId || null,
      autoResetIp: body.autoResetIp,
      browserType: body.browserType,
      browserProvider: body.browserProvider,
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

/**
 * DELETE /api/profiles/:id - Delete profile
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await profileService.deleteProfile(params.id)

    return NextResponse.json({
      success: true,
      message: 'Profile deleted successfully',
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

