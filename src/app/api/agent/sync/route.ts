import { NextRequest, NextResponse } from 'next/server'
import { validateAgentAuth } from '@/lib/agent/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface SyncProfile {
  id: string
  name: string
  group_id?: number
  raw_proxy?: string
  browser_type?: string
  browserProvider?: string
  connectionId?: string
}

/**
 * POST /api/agent/sync - Agent pushes profiles synced from local GPMLogin/GPMGlobal
 * This replaces direct GPMLogin API calls from Vercel (which can't reach localhost)
 */
export async function POST(req: NextRequest) {
  if (!validateAgentAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { profiles, provider, connectionId } = body as {
      profiles: SyncProfile[]
      provider?: string
      connectionId?: string
    }

    if (!profiles || !Array.isArray(profiles)) {
      return NextResponse.json(
        { success: false, error: 'profiles array is required' },
        { status: 400 }
      )
    }

    const browserProvider = provider || 'gpmlogin'
    let synced = 0

    for (const p of profiles) {
      const profileUid = String(p.id)
      const existing = await prisma.profile.findUnique({ where: { profileUid } })

      if (!existing) {
        await prisma.profile.create({
          data: {
            name: p.name || `Profile ${profileUid}`,
            profileUid,
            groupId: p.group_id || null,
            browserType: normalizeBrowserType(p.browser_type),
            browserProvider,
            browserConnectionId: connectionId || null,
            status: 'idle',
          },
        })
        synced++
      } else {
        await prisma.profile.update({
          where: { profileUid },
          data: {
            name: p.name || existing.name,
            groupId: p.group_id ?? existing.groupId,
            browserProvider: browserProvider,
            browserConnectionId: connectionId || existing.browserConnectionId,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      total: profiles.length,
      updated: profiles.length - synced,
      provider: browserProvider,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

function normalizeBrowserType(raw?: string): string {
  if (!raw) return 'gpm'
  const n = raw.toLowerCase().trim()
  if (n === 'firefox' || n === 'ff' || n === 'moz') return 'firefox'
  if (n === 'chromium') return 'chromium'
  return 'gpm'
}
