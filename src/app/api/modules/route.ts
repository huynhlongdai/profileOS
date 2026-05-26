import { NextRequest, NextResponse } from 'next/server'
import { ModuleService } from '@/core/services/ModuleService'

const moduleService = new ModuleService()

/**
 * GET /api/modules - List all modules (merged from registry and DB config)
 */
export async function GET(request: NextRequest) {
  try {
    const modules = await moduleService.listModules()

    return NextResponse.json({
      success: true,
      modules,
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
 * PATCH /api/modules - Update module enabled state
 * Body: { name: string, enabled: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, enabled } = body

    if (!name || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Invalid body: name (string) and enabled (boolean) are required' },
        { status: 400 }
      )
    }

    const moduleConfig = await moduleService.setModuleEnabled(name, enabled)

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

