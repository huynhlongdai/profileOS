import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/profiles/fix-browser-type - Fix browser type for existing profiles
 * Updates all profiles with browserType = 'chromium' or null to 'gpm'
 * since GPMLogin profiles are GPM browser by default
 */
export async function POST(request: NextRequest) {
  try {
    // Get all profiles
    const profiles = await prisma.profile.findMany({
      select: {
        id: true,
        name: true,
        browserType: true,
      },
    })

    let updatedCount = 0
    const updates: Array<{ id: string; name: string; oldType: string | null; newType: string }> = []

    for (const profile of profiles) {
      // Update if browserType is null, 'chromium', or 'chrome'
      if (
        !profile.browserType ||
        profile.browserType.toLowerCase() === 'chromium' ||
        profile.browserType.toLowerCase() === 'chrome'
      ) {
        const oldType = profile.browserType
        await prisma.profile.update({
          where: { id: profile.id },
          data: { browserType: 'gpm' },
        })
        updatedCount++
        updates.push({
          id: profile.id,
          name: profile.name,
          oldType,
          newType: 'gpm',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} profiles to GPM browser type`,
      updatedCount,
      updates: updates.slice(0, 10), // Show first 10 updates
      totalProfiles: profiles.length,
    })
  } catch (error) {
    console.error('Error fixing browser types:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

