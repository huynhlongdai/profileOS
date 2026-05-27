import { NextRequest, NextResponse } from 'next/server'
import { sessions } from '@/lib/recorder-store'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    session.status = 'recording'
    return NextResponse.json({ sessionId, status: 'recording' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}
