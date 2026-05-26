import { NextRequest, NextResponse } from 'next/server'
import { autoRegBaseUrl } from '@/lib/autoReg/manager'

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams
    const query = new URLSearchParams()
    for (const key of ['platform', 'status']) {
      const value = search.get(key)
      if (value) query.set(key, value)
    }
    const suffix = query.toString()
    const url = `${autoRegBaseUrl()}/accounts/export${suffix ? `?${suffix}` : ''}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt || `Export failed with ${res.status}`)
    }
    const csv = await res.text()
    return NextResponse.json({ success: true, data: csv })
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
