import { NextRequest, NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

type Params = { params: { platform: string; actionId: string } }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const body = await request.json()
    const data = await autoRegFetch(`/actions/${params.platform}/${params.actionId}/batch`, {
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
