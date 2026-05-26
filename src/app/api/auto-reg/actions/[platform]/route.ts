import { NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

type Params = { params: { platform: string } }

export async function GET(_: Request, { params }: Params) {
  try {
    const data = await autoRegFetch(`/actions/${params.platform}`)
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
