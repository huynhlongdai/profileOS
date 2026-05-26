import { NextRequest, NextResponse } from 'next/server'
import { AccountService } from '@/core/services/AccountService'

const accountService = new AccountService()

/**
 * GET /api/accounts/export - Export accounts to CSV or JSON
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json' // 'json' or 'csv'

    const result = await accountService.listAccounts({ limit: 10000 }) // Get all accounts
    const accounts = result.accounts

    if (format === 'csv') {
      // CSV format with all fields
      const headers = [
        'Label',
        'Account Type',
        'Identifier',
        'Password',
        '2FA Secret',
        'Profile Name',
        'Profile ID',
        'Proxy Label',
        'Proxy ID',
        'Auto Change Proxy',
        'Status',
        'Notes',
        'Created At',
        'Updated At',
      ]
      const rows = accounts.map((acc) => [
        (acc as any).label || '',
        (acc as any).accountType || '',
        (acc as any).identifier || '',
        (acc as any).passwordEncrypted || '',
        (acc as any).twoFactorSecret || '',
        (acc as any).profile?.name || '',
        (acc as any).gpmloginProfileId || '',
        (acc as any).profile?.proxy?.label || (acc as any).proxy?.label || '',
        (acc as any).proxyId || '',
        acc.autoChangeProxy ? 'true' : 'false',
        acc.status || '',
        acc.notes || '',
        acc.createdAt ? new Date(acc.createdAt).toISOString() : '',
        acc.updatedAt ? new Date(acc.updatedAt).toISOString() : '',
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="accounts_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    } else {
      // JSON format with all fields
      const jsonData = accounts.map((acc) => ({
        label: acc.label,
        accountType: acc.accountType,
        identifier: acc.identifier,
        password: acc.passwordEncrypted,
        twoFactorSecret: acc.twoFactorSecret,
        profileName: (acc as any).profile?.name || null,
        profileId: acc.gpmloginProfileId || null,
        proxyLabel: (acc as any).profile?.proxy?.label || (acc as any).proxy?.label || null,
        proxyId: acc.proxyId || null,
        autoChangeProxy: acc.autoChangeProxy,
        status: acc.status,
        notes: acc.notes,
        cookiesJson: acc.cookiesJson || null,
        createdAt: acc.createdAt ? new Date(acc.createdAt).toISOString() : null,
        updatedAt: acc.updatedAt ? new Date(acc.updatedAt).toISOString() : null,
        lastCheck: acc.lastCheck ? new Date(acc.lastCheck).toISOString() : null,
        lastLogin: acc.lastLogin ? new Date(acc.lastLogin).toISOString() : null,
        lastCare: acc.lastCare ? new Date(acc.lastCare).toISOString() : null,
      }))

      return NextResponse.json({
        success: true,
        accounts: jsonData,
        exportedAt: new Date().toISOString(),
        total: jsonData.length,
      })
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

