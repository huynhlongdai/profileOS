import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

/**
 * GET /api/account-types/:id - Get account type by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure core is initialized
    core.init()
    
    const accountType = await core.services.accountTypeService.getAccountTypeById(params.id)

    if (!accountType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Account type not found',
        },
        { status: 404 }
      )
    }

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

/**
 * PUT /api/account-types/:id - Update account type
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure core is initialized
    core.init()
    
    const body = await request.json()

    const updateData: any = {}
    if (body.label !== undefined) updateData.label = body.label
    if (body.description !== undefined) updateData.description = body.description
    if (body.icon !== undefined) updateData.icon = body.icon
    if (body.loginUrl !== undefined) updateData.loginUrl = body.loginUrl
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder

    const accountType = await core.services.accountTypeService.updateAccountType(params.id, updateData)

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

/**
 * DELETE /api/account-types/:id - Delete account type
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure core is initialized
    core.init()
    
    await core.services.accountTypeService.deleteAccountType(params.id)

    return NextResponse.json({
      success: true,
      message: 'Account type deleted successfully',
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

