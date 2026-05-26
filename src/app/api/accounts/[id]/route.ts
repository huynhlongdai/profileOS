import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

/**
 * GET /api/accounts/:id - Get account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    core.init()
    const account = await core.services.accountService.getAccount(params.id)

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      account,
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
 * PUT /api/accounts/:id - Update account
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    core.init()
    const body = await request.json()

    const account = await core.services.accountService.updateAccount(params.id, {
      label: body.label,
      accountType: body.accountType,
      passwordEncrypted: body.password || body.passwordEncrypted,
      twoFactorSecret: body.twoFactorSecret,
      loginMethod: body.loginMethod,
      authViaAccountId: body.authViaAccountId,
      gpmloginProfileId: body.gpmloginProfileId,
      proxyId: body.proxyId,
      autoChangeProxy: body.autoChangeProxy,
      notes: body.notes,
      status: body.status,
      customLoginUrl: body.customLoginUrl,
    })

    return NextResponse.json({
      success: true,
      account,
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
 * DELETE /api/accounts/:id - Delete account
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    core.init()
    await core.services.accountService.deleteAccount(params.id)

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

