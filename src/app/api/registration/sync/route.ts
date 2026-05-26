import { NextRequest, NextResponse } from 'next/server'
import { RegistrationService } from '@/core/services/RegistrationService'

export async function POST(req: NextRequest) {
  try {
    const { platform } = await req.json().catch(() => ({}))
    
    const registrationService = RegistrationService.getInstance()
    const result = await registrationService.syncAccounts(platform)
    
    return NextResponse.json({ success: true, synced: result.success, skipped: result.skipped })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
