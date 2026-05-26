import { NextRequest, NextResponse } from 'next/server'
import { ProfileService } from '@/core/services/ProfileService'

const profileService = new ProfileService()

/**
 * POST /api/profiles/verify-status
 * Verify the actual status of profiles and update if needed
 */
export async function POST(request: NextRequest) {
    try {
        const { profileIds } = await request.json()

        if (!Array.isArray(profileIds)) {
            return NextResponse.json(
                { success: false, error: 'profileIds must be an array' },
                { status: 400 }
            )
        }

        console.log('[API /api/profiles/verify-status] Verifying status for profiles:', profileIds)

        const verified: Record<string, { actualStatus: string; updated: boolean }> = {}

        for (const profileId of profileIds) {
            try {
                const result = await profileService.verifyProfileStatus(profileId)
                verified[profileId] = result

                if (result.updated) {
                    console.log(`[API /api/profiles/verify-status] Profile ${profileId} status updated to ${result.actualStatus}`)
                }
            } catch (error) {
                console.error(`[API /api/profiles/verify-status] Error verifying profile ${profileId}:`, error)
                // Continue with other profiles even if one fails
            }
        }

        const updatedCount = Object.values(verified).filter(v => v.updated).length
        console.log(`[API /api/profiles/verify-status] Verified ${profileIds.length} profiles, updated ${updatedCount}`)

        return NextResponse.json({
            success: true,
            verified,
            updatedCount,
        })
    } catch (error) {
        console.error('[API /api/profiles/verify-status] Error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
