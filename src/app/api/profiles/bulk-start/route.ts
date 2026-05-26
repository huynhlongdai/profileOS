import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/core/services/ProfileService'

const profileService = new ProfileService()

/**
 * POST /api/profiles/bulk-start - Start multiple profiles
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileIds } = body

    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'profileIds array is required',
        },
        { status: 400 }
      )
    }

    const results = []
    const errors = []

    for (const profileId of profileIds) {
      try {
        await profileService.startProfile(profileId)
        results.push({ profileId, success: true })
      } catch (error) {
        errors.push({
          profileId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      errors,
      total: profileIds.length,
      succeeded: results.length,
      failed: errors.length,
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

