import { NextRequest, NextResponse } from 'next/server'
import { sessions } from '@/lib/recorder-store'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  const session = sessions.get(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  return NextResponse.json({
    sessionId,
    status: session.status,
    actionCount: session.actions.length,
    startedAt: session.startedAt,
    debugPort: session.debugPort,
  })
}
