import { NextRequest, NextResponse } from 'next/server'
import { AutomationService } from '@/core/services/AutomationService'

const automationService = new AutomationService()

/**
 * POST /api/automation/recordings/[id]/stop
 * Stop recording
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const recording = await automationService.stopRecording(params.id)

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
