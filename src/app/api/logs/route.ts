import { NextRequest, NextResponse } from 'next/server'
import { LogService } from '@/core/services/LogService'

const logService = new LogService()

/**
 * GET /api/logs - List logs
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId') || undefined
    const moduleFilter = searchParams.get('module') || undefined
    const type = searchParams.get('type') || undefined
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    const result = await logService.listLogs({
      accountId,
      module: moduleFilter,
      type,
      from,
      to,
      page,
      limit,
    })

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

