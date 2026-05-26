import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/accounts/sync-labels - Sync all account labels to 4-digit format
 * This will regenerate all labels to be sequential 4-digit numbers (0001, 0002, ...)
 */
export async function POST(request: NextRequest) {
  try {
    // Get all accounts ordered by createdAt
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    // Update each account with sequential label
    const updates = accounts.map((account, index) => {
      const newLabel = String(index + 1).padStart(4, '0')
      return prisma.account.update({
        where: { id: account.id },
        data: { label: newLabel },
      })
    })

    await Promise.all(updates)

    return NextResponse.json({
      success: true,
      message: `Updated ${accounts.length} account labels`,
      updated: accounts.length,
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

