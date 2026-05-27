import { NextRequest, NextResponse } from 'next/server'
import { sessions } from '@/lib/recorder-store'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()
    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    session.status = 'stopped'
    if (session.pollInterval) {
      clearInterval(session.pollInterval)
      session.pollInterval = undefined
    }
    if (session.ws) {
      session.ws.close()
      session.ws = undefined
    }

    const steps = session.actions.map((a, i) => ({
      id: `step-${i + 1}`,
      action: a.action,
      label: a.label,
      params: a.params,
      enabled: true,
    }))

    return NextResponse.json({
      sessionId,
      status: 'stopped',
      actionCount: session.actions.length,
      steps,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}
