import { NextRequest, NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const platform = body?.platform ? `?platform=${encodeURIComponent(String(body.platform))}` : ''
    const data = await autoRegFetch(`/accounts/check-all${platform}`, {
      method: 'POST',
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
