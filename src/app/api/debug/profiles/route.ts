import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * GET /api/debug/profiles
 * Debug endpoint to check profile status
 */
export async function GET(request: NextRequest) {
    try {
        const profiles = await prisma.profile.findMany({
            select: {
                id: true,
                name: true,
                status: true,
                remoteDebuggingPort: true,
                browserProvider: true,
                processId: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: 10,
        })

        const runningProfiles = profiles.filter((p) => p.status === 'running')

        return NextResponse.json({
            success: true,
            summary: {
                total: profiles.length,
                running: runningProfiles.length,
                withDebugPort: runningProfiles.filter((p) => p.remoteDebuggingPort)
                    .length,
            },
            profiles,
            runningProfiles,
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
