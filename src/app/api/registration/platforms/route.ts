import { NextResponse } from 'next/server'
import { RegistrationService } from '@/core/services/RegistrationService'

export async function GET() {
  try {
    const registrationService = RegistrationService.getInstance()
    const platforms = await registrationService.listPlatforms()
    return NextResponse.json({ success: true, platforms })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
