import { NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

export async function POST() {
  try {
    const data = await autoRegFetch('/integrations/services/start-all', { method: 'POST' })
    return NextResponse.json({ success: true, data })
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
