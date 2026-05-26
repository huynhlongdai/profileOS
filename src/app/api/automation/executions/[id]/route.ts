import { NextRequest, NextResponse } from 'next/server'
import { AutomationService } from '@/core/services/AutomationService'

const automationService = new AutomationService()

/**
 * GET /api/automation/executions/[id]
 * Get execution details
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const execution = await automationService.getExecution(params.id)

        if (!execution) {
            return NextResponse.json(
                { success: false, error: 'Execution not found' },
                { status: 404 }
            )
        }

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
