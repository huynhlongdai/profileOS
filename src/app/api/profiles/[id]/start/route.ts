import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/core/services/ProfileService'

const profileService = new ProfileService()

// Allow up to 60 seconds for GPMLogin to start the profile
export const maxDuration = 60

/**
 * POST /api/profiles/:id/start - Start profile
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId') || undefined
    const profile = await profileService.startProfile(params.id, accountId)

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : 'Unknown error'

    // Detect GPMLogin connection refused (Node fetch throws "fetch failed" for ECONNREFUSED)
    const isConnectionError =
      rawMsg.includes('fetch failed') ||
      rawMsg.includes('ECONNREFUSED') ||
      rawMsg.includes('connect ECONNREFUSED') ||
      rawMsg.includes('Không kết nối GPMLogin')

    const friendlyMsg =
      isConnectionError && !rawMsg.includes('http')
        ? 'Không thể kết nối GPMLogin API. Vào Cài đặt → Connections, bấm "Kiểm tra" với URL đúng (vd. http://127.0.0.1:19496) và mở GPMLogin trước.'
        : rawMsg

    return NextResponse.json(
      { success: false, error: friendlyMsg },
      { status: 500 }
    )
  }
}

