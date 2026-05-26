import { NextRequest, NextResponse } from 'next/server'
import { AutomationService } from '@/core/services/AutomationService'

const automationService = new AutomationService()

/**
 * GET /api/automation/recordings/[id]
 * Get recording details
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const recording = await automationService.getRecording(params.id)

        if (!recording) {
            return NextResponse.json(
                { success: false, error: 'Recording not found' },
                { status: 404 }
            )
        }

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

/**
 * DELETE /api/automation/recordings/[id]
 * Delete recording
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await automationService.deleteRecording(params.id)

        return NextResponse.json({
            success: true,
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
