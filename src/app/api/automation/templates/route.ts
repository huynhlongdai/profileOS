import { NextRequest, NextResponse } from 'next/server'
import { AutomationService } from '@/core/services/AutomationService'

const automationService = new AutomationService()

/**
 * GET /api/automation/templates
 * List templates
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const category = searchParams.get('category') || undefined
        const isPublic = searchParams.get('isPublic')
            ? searchParams.get('isPublic') === 'true'
            : undefined
        const search = searchParams.get('search') || undefined

        const templates = await automationService.listTemplates({
            category,
            isPublic,
            search,
        })

        return NextResponse.json({
            success: true,
            templates,
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
 * POST /api/automation/templates
 * Create template
 */
export async function POST(request: NextRequest) {
    try {
        const data = await request.json()

        const template = await automationService.createTemplate(data)

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
