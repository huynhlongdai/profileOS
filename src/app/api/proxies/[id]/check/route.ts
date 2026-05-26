import { NextRequest, NextResponse } from 'next/server'
import { ProxyService } from '@/core/services/ProxyService'

const proxyService = new ProxyService()

/**
 * POST /api/proxies/:id/check - Check proxy
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await proxyService.checkProxy(params.id)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

