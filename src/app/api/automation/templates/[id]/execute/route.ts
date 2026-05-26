import { NextRequest, NextResponse } from 'next/server'
import { AutomationService } from '@/core/services/AutomationService'

const automationService = new AutomationService()

/**
 * POST /api/automation/templates/[id]/execute
 * Execute template
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { profileId, variables } = await request.json()

        if (!profileId) {
            return NextResponse.json(
                { success: false, error: 'profileId is required' },
                { status: 400 }
            )
        }

        const execution = await automationService.executeTemplate(
            params.id,
            profileId,
            variables || {}
        )

        return NextResponse.json({
            success: true,
            execution,
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
