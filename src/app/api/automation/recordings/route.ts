import { NextRequest, NextResponse } from 'next/server'
import { AutomationService } from '@/core/services/AutomationService'

const automationService = new AutomationService()

/**
 * GET /api/automation/recordings
 * List all recordings
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get('status') || undefined
        const accountType = searchParams.get('accountType') || undefined
        const search = searchParams.get('search') || undefined

        const recordings = await automationService.listRecordings({
            status,
            accountType,
            search,
        })

        return NextResponse.json({
            success: true,
            recordings,
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
 * POST /api/automation/recordings
 * Create new recording
 */
export async function POST(request: NextRequest) {
    try {
        const { profileId, name, description } = await request.json()

        if (!profileId || !name) {
            return NextResponse.json(
                { success: false, error: 'profileId and name are required' },
                { status: 400 }
            )
        }

        const recording = await automationService.startRecording(
            profileId,
            name,
            description
        )

        return NextResponse.json({
            success: true,
            recording,
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
