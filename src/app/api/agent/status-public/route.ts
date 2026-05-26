import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const heartbeat = await prisma.agentHeartbeat.findFirst({ where: { id: 'default' } })

    const isOnline = heartbeat
      ? (Date.now() - heartbeat.lastSeen.getTime()) < 30000
      : false

    return NextResponse.json({
      agent: {
        isOnline,
        lastSeen: heartbeat?.lastSeen || null,
        version: heartbeat?.agentVersion || null,
        providers: heartbeat?.providers ? JSON.parse(heartbeat.providers) : [],
      },
    })
  } catch {
    return NextResponse.json({ agent: { isOnline: false, lastSeen: null, version: null, providers: [] } })
  }
}
