import { NextRequest, NextResponse } from 'next/server'
import { AutomationService } from '@/core/services/AutomationService'

const automationService = new AutomationService()

/**
 * GET /api/automation/templates/[id]
 * Get template details
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const template = await automationService.getTemplate(params.id)

        if (!template) {
            return NextResponse.json(
                { success: false, error: 'Template not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            template,
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
 * PUT /api/automation/templates/[id]
 * Update template
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const data = await request.json()
        const template = await automationService.updateTemplate(params.id, data)

        return NextResponse.json({
            success: true,
            template,
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
 * DELETE /api/automation/templates/[id]
 * Delete template
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await automationService.deleteTemplate(params.id)

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
