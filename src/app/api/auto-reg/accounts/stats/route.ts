import { NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

export async function GET() {
  try {
    const data = await autoRegFetch('/accounts/stats')
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
