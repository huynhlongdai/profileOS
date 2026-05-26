import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

/**
 * POST /api/profiles/:id/stop - Stop profile
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    core.init()
    const profile = await core.services.profileService.stopProfile(params.id)

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    console.error('Error stopping profile:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

