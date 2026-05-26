import { NextRequest, NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

export async function GET() {
  try {
    const data = await autoRegFetch('/proxies')
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = await autoRegFetch('/proxies', {
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
