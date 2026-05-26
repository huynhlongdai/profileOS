import { NextRequest, NextResponse } from 'next/server'
import { AutomationService } from '@/core/services/AutomationService'

const automationService = new AutomationService()

/**
 * POST /api/automation/recordings/[id]/convert
 * Convert recording to template
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { name, description, category, variables } = await request.json()

        if (!name || !category) {
            return NextResponse.json(
                { success: false, error: 'name and category are required' },
                { status: 400 }
            )
        }

        const template = await automationService.convertToTemplate(params.id, {
            name,
            description,
            category,
            variables,
        })

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
