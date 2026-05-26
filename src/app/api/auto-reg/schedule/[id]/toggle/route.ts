import { NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

type Params = { params: { id: string } }

export async function POST(_: Request, { params }: Params) {
  try {
    const data = await autoRegFetch(`/tasks/schedule/${params.id}/toggle`, {
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
