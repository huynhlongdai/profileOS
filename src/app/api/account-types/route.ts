import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

/**
 * GET /api/account-types - List all account types
 */
export async function GET(request: NextRequest) {
  try {
    // Ensure core is initialized
    core.init()
    
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const accountTypes = await core.services.accountTypeService.getAllAccountTypes(includeInactive)

    // Include account count for each type
    const { prisma } = await import('@/lib/prisma')
    const accountTypesWithCount = await Promise.all(
      accountTypes.map(async (type) => {
        const count = await prisma.account.count({
          where: { accountType: type.name },
        })
        return {
          ...type,
          _count: { accounts: count },
        }
      })
    )

    return NextResponse.json({
      success: true,
      accountTypes: accountTypesWithCount,
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
 * POST /api/account-types - Create new account type
 */
export async function POST(request: NextRequest) {
  try {
    // Ensure core is initialized
    core.init()
    
    const body = await request.json()

    if (!body.name || !body.label) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name and label are required',
        },
        { status: 400 }
      )
    }

    const accountType = await core.services.accountTypeService.createAccountType({
      name: body.name,
      label: body.label,
      description: body.description || undefined,
      icon: body.icon || undefined,
      loginUrl: body.loginUrl || undefined,
      sortOrder: body.sortOrder || 0,
    })

    return NextResponse.json({
      success: true,
      accountType,
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

