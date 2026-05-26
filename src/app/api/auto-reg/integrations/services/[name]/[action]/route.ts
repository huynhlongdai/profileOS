import { NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

type Params = { params: { name: string; action: string } }

export async function POST(_: Request, { params }: Params) {
  try {
    const allowed = new Set(['start', 'stop', 'install'])
    if (!allowed.has(params.action)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
    const data = await autoRegFetch(`/integrations/services/${params.name}/${params.action}`, {
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
