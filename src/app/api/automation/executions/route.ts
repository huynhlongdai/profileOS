import { NextRequest, NextResponse } from 'next/server'
import { AutomationService } from '@/core/services/AutomationService'

const automationService = new AutomationService()

/**
 * GET /api/automation/executions
 * List executions
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const profileId = searchParams.get('profileId') || undefined
        const templateId = searchParams.get('templateId') || undefined
        const status = searchParams.get('status') || undefined

        const executions = await automationService.listExecutions({
            profileId,
            templateId,
            status,
        })

        return NextResponse.json({
            success: true,
            executions,
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
