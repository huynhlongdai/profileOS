import { NextRequest, NextResponse } from 'next/server'
import { AccountService } from '@/core/services/AccountService'

const accountService = new AccountService()

/**
 * GET /api/accounts - List accounts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    // BUG-4 FIX: tăng default limit từ 100 lên 10000 → tránh mất data khi có nhiều accounts
    const limit = parseInt(searchParams.get('limit') || '10000')

    // DEBUG: Log API parameters
    console.log('[API /api/accounts] GET request with params:', {
      status,
      type,
      search,
      page,
      limit,
    })

    const result = await accountService.listAccounts({
      status,
      type,
      search,
      page,
      limit,
    })

    return NextResponse.json({
      success: true,
      ...result,
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
 * POST /api/accounts - Create account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const account = await accountService.createAccount({
      label: body.label,
      accountType: body.accountType,
      identifier: body.identifier,
      passwordEncrypted: body.password || body.passwordEncrypted,
      twoFactorSecret: body.twoFactorSecret,
      loginMethod: body.loginMethod,
      authViaAccountId: body.authViaAccountId,
      gpmloginProfileId: body.gpmloginProfileId,
      proxyId: body.proxyId,
      autoChangeProxy: body.autoChangeProxy || false,
      notes: body.notes,
      autoCreateProfile: body.autoCreateProfile || false,
      autoCreateProfileGroupId: body.autoCreateProfileGroupId,
      autoCreateProfileBrowserType: body.autoCreateProfileBrowserType || 'gpm',
      autoCreateProfileBrowserProvider: body.autoCreateProfileBrowserProvider || 'gpmlogin',
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

