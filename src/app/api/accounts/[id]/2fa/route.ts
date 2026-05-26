import { NextRequest, NextResponse } from 'next/server'
import { AccountService } from '@/core/services/AccountService'
import { generateTOTP } from '@/lib/totp'

const accountService = new AccountService()

/**
 * GET /api/accounts/:id/2fa - Generate 2FA code for account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const account = await accountService.getAccount(params.id)

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    if (!account.twoFactorSecret) {
      return NextResponse.json(
        { success: false, error: 'Account does not have 2FA secret configured' },
        { status: 400 }
      )
    }

    try {
      const code = generateTOTP(account.twoFactorSecret)
      return NextResponse.json({
        success: true,
        code,
        accountId: account.id,
        identifier: account.identifier,
      })
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate 2FA code',
        },
        { status: 500 }
      )
    }
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

