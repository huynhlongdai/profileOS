import { NextRequest, NextResponse } from 'next/server'
import { AccountService } from '@/core/services/AccountService'

const accountService = new AccountService()

/**
 * GET /api/accounts/:id/password - Get account password (for copy function)
 * Note: Password is currently stored as plaintext in passwordEncrypted field
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

    // Note: Currently passwordEncrypted is plaintext (no encryption implemented)
    // TODO: Implement decryption if encryption is added
    return NextResponse.json({
      success: true,
      password: account.passwordEncrypted || '',
      identifier: account.identifier,
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

