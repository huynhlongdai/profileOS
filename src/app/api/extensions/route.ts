import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

/**
 * GET /api/extensions - List all extensions
 */
export async function GET(request: NextRequest) {
  try {
    core.init()
    const searchParams = request.nextUrl.searchParams
    const enabledOnly = searchParams.get('enabledOnly') === 'true'

    const extensions = await core.services.extensionService.getAllExtensions(enabledOnly)

    return NextResponse.json({
      success: true,
      extensions,
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
 * POST /api/extensions - Create new extension from store URL
 */
export async function POST(request: NextRequest) {
  try {
    core.init()
    const body = await request.json()

    if (!body.storeUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'storeUrl is required',
        },
        { status: 400 }
      )
    }

    // Extract extension info from URL
    const extensionId = core.services.extensionService.extractExtensionId(body.storeUrl)
    
    // Try to get extension info (name, icon, etc.)
    const extensionInfo = await core.services.extensionService.getExtensionInfo(body.storeUrl)

    const extension = await core.services.extensionService.createOrGetExtension({
      name: body.name || extensionInfo?.name || extensionId,
      extensionId,
      storeUrl: body.storeUrl,
      icon: body.icon || extensionInfo?.icon,
      description: body.description || extensionInfo?.description,
      version: body.version,
    })

    return NextResponse.json({
      success: true,
      extension,
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

