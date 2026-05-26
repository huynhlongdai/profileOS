import { NextRequest, NextResponse } from 'next/server'
import { ProxyService } from '@/core/services/ProxyService'

const proxyService = new ProxyService()

/**
 * GET /api/proxies - List proxies
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined

    const proxies = await proxyService.listProxies({ status })

    return NextResponse.json({
      success: true,
      proxies,
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

/**
 * POST /api/proxies - Create proxy
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const proxy = await proxyService.createProxy({
      label: body.label,
      rawProxy: body.rawProxy,
      proxyServerUrl: body.proxyServerUrl,
      ipBefore: body.ipBefore,
    })

    return NextResponse.json({
      success: true,
      proxy,
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

