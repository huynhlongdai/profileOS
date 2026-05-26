import { NextRequest, NextResponse } from 'next/server'
import { validateAgentAuth } from '@/lib/agent/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agent/profiles - List profiles for agent operations
 * Returns profiles with their proxy and account info
 */
export async function GET(req: NextRequest) {
  if (!validateAgentAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get('status') || undefined

    const profiles = await prisma.profile.findMany({
      where: status ? { status } : undefined,
      include: {
        proxy: true,
        accounts: {
          select: {
            id: true,
            label: true,
            accountType: true,
            status: true,
          },
        },
        connection: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, profiles })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
