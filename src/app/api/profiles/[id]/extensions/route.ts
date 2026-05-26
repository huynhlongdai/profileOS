import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

/**
 * GET /api/profiles/:id/extensions - Get extensions for a profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    core.init()
    const extensions = await core.services.extensionService.getProfileExtensions(params.id)

    return NextResponse.json({
      success: true,
      extensions,
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
 * POST /api/profiles/:id/extensions - Add extension to profile
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    core.init()
    const body = await request.json()

    if (!body.extensionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'extensionId is required',
        },
        { status: 400 }
      )
    }

    const profileExtension = await core.services.extensionService.addExtensionToProfile({
      profileId: params.id,
      extensionId: body.extensionId,
    })

    return NextResponse.json({
      success: true,
      profileExtension,
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
 * DELETE /api/profiles/:id/extensions/:extensionId - Remove extension from profile
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; extensionId: string } }
) {
  try {
    core.init()
    await core.services.extensionService.removeExtensionFromProfile(params.id, params.extensionId)

    return NextResponse.json({
      success: true,
      message: 'Extension removed from profile',
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

