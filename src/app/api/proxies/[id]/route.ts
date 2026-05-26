import { NextRequest, NextResponse } from 'next/server'
import { ProxyService } from '@/core/services/ProxyService'

const proxyService = new ProxyService()

/**
 * GET /api/proxies/:id - Get proxy by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const proxy = await proxyService.getProxy(params.id)

    if (!proxy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Proxy not found',
        },
        { status: 404 }
      )
    }

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

/**
 * PUT /api/proxies/:id - Update proxy
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const proxy = await proxyService.updateProxy(params.id, {
      label: body.label,
      rawProxy: body.rawProxy,
      proxyServerUrl: body.proxyServerUrl,
      status: body.status,
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

/**
 * DELETE /api/proxies/:id - Delete proxy
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await proxyService.deleteProxy(params.id)

    return NextResponse.json({
      success: true,
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

