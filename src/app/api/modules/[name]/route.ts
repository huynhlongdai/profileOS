import { NextRequest, NextResponse } from 'next/server'
import { ModuleService } from '@/core/services/ModuleService'

const moduleService = new ModuleService()

/**
 * PATCH /api/modules/:name - Update module enabled state
 * Body: { enabled: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Invalid body: enabled (boolean) is required' },
        { status: 400 }
      )
    }

    const moduleConfig = await moduleService.setModuleEnabled(params.name, enabled)

    return NextResponse.json({
      success: true,
      module: moduleConfig,
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

