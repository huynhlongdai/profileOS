import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/core/services/ProfileService'

const profileService = new ProfileService()

/**
 * PUT /api/profiles/:id/proxy - Change profile proxy
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const proxyId = body.proxyId || null

    await profileService.changeProfileProxy(params.id, proxyId)

    return NextResponse.json({
      success: true,
      message: 'Proxy updated',
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

