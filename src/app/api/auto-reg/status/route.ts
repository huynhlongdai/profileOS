import { NextResponse } from 'next/server'
import { autoRegManager } from '@/lib/autoReg/manager'

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      status: autoRegManager.getStatus(),
    })
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
