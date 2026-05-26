import { NextRequest, NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = await autoRegFetch('/tasks/register', {
      method: 'POST',
      body: JSON.stringify(body),
    })
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
