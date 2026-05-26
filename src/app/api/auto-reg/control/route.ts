import { NextRequest, NextResponse } from 'next/server'
import { autoRegManager } from '@/lib/autoReg/manager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body?.action as 'start' | 'stop'

    if (action === 'start') {
      const status = await autoRegManager.start()
      return NextResponse.json({ success: true, status })
    }

    if (action === 'stop') {
      const status = autoRegManager.stop()
      return NextResponse.json({ success: true, status })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use start|stop' },
      { status: 400 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
