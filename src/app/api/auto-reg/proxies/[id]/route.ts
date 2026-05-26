import { NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

type Params = { params: { id: string } }

export async function DELETE(_: Request, { params }: Params) {
  try {
    const data = await autoRegFetch(`/proxies/${params.id}`, {
      method: 'DELETE',
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
