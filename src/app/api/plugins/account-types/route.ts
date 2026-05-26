import { NextRequest, NextResponse } from 'next/server'
import { initCore } from '@/core/bootstrap'

/**
 * GET /api/plugins/account-types - Get plugin info for account types
 * Query params: types (comma-separated) - e.g., ?types=gmail,coingecko
 * If no types specified, returns info for all active account types from database
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize core to ensure plugins are registered
    const core = initCore()
    
    const searchParams = request.nextUrl.searchParams
    const typesParam = searchParams.get('types')
    const accountTypes = typesParam ? typesParam.split(',').map((t) => t.trim()) : []

    const pluginManager = core.pluginManager
    const moduleService = core.moduleService
    const accountTypeService = core.accountTypeService

    if (!accountTypeService) {
      console.error('[API] accountTypeService is not available')
      return NextResponse.json(
        {
          success: false,
          error: 'AccountTypeService not initialized',
        },
        { status: 500 }
      )
    }

    // Get all modules to map account types to module labels
    const modules = await moduleService.listModules()
    
    // Map account types to modules (from plugin configuration)
    // gmail -> gmail module
    // coingecko -> coingecko_candy module
    const accountTypeToModuleMap: Record<string, string> = {
      gmail: 'gmail',
      coingecko: 'coingecko_candy',
    }

    const result: Record<
      string,
      {
        accountType: string
        pluginName: string | null
        pluginLabel: string | null
        moduleEnabled: boolean
        hasCheck: boolean
        hasCare: boolean
        hasLogin: boolean
      }
    > = {}

    // If no types specified, get all active account types from database
    let typesToCheck: string[] = accountTypes
    if (typesToCheck.length === 0) {
      const allAccountTypes = await accountTypeService.getAllAccountTypes(false) // Only active
      typesToCheck = allAccountTypes.map((type: any) => type.name)
    }

    for (const accountType of typesToCheck) {
      const plugin = pluginManager.getPluginForAccountTypeSync(accountType)
      const moduleName = accountTypeToModuleMap[accountType] || accountType
      const moduleConfig = modules.find((m) => m.name === moduleName)

      result[accountType] = {
        accountType,
        pluginName: plugin?.name || null,
        pluginLabel: moduleConfig?.label || plugin?.name || null,
        moduleEnabled: moduleConfig?.enabled ?? true,
        hasCheck: !!plugin?.checkAccount,
        hasCare: !!plugin?.careAccount,
        hasLogin: !!plugin?.loginAccount,
      }
    }

    return NextResponse.json({
      success: true,
      plugins: result,
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

