import { NextRequest, NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams
    const platform = search.get('platform')
    const page = search.get('page') || '1'
    const pageSize = search.get('page_size') || '50'
    const query = new URLSearchParams()
    if (platform) query.set('platform', platform)
    query.set('page', page)
    query.set('page_size', pageSize)
    const data = await autoRegFetch(`/tasks/logs?${query.toString()}`)
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
    const data = await autoRegFetch('/tasks/logs/batch-delete', {
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
