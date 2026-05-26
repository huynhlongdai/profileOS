import { NextRequest, NextResponse } from 'next/server'
import { autoRegFetch } from '@/lib/autoReg/manager'

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams
    const query = new URLSearchParams()
    for (const key of ['platform', 'status', 'email', 'page', 'page_size']) {
      const value = search.get(key)
      if (value) query.set(key, value)
    }
    const suffix = query.toString()
    const data = await autoRegFetch(`/accounts${suffix ? `?${suffix}` : ''}`)
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
