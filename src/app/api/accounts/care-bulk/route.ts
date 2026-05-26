import { NextRequest, NextResponse } from 'next/server'
import { core } from '@/core/bootstrap'

/**
 * POST /api/accounts/care-bulk - Bulk care accounts
 * 
 * Uses TaskService from core bootstrap for queue management
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[API] POST /api/accounts/care-bulk - Starting')
    
    // Ensure core is initialized
    const coreServices = core.services
    console.log('[API] Core services initialized')
    
    const body = await req.json()
    const accountIds: string[] = body.accountIds || []
    
    console.log(`[API] Received ${accountIds.length} account IDs:`, accountIds)

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'accountIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Ở đây có thể tính priority theo status nếu muốn.
    // Đơn giản: priority = 0. Nâng cao: query status account rồi assign priority khác nhau.
    console.log('[API] Enqueuing care tasks...')
    await coreServices.taskService.enqueueCare(accountIds)
    console.log(`[API] ✅ Successfully enqueued ${accountIds.length} care tasks`)

    return NextResponse.json({
      success: true,
      count: accountIds.length,
      message: `Enqueued ${accountIds.length} accounts for care`,
    })
  } catch (error) {
    console.error('[API] ❌ Error in bulk care:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

