/**
 * API Route: Update module configuration
 * PATCH /api/modules/[name]/config
 */

import { NextRequest, NextResponse } from 'next/server'
import { ModuleService } from '@/core/services/ModuleService'
import { parseGmailConfig } from '@/plugins/gmail/gmailConfig'

const moduleService = new ModuleService()

export async function PATCH(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const name = params.name
    const body = await req.json()

    // Hiện tại ta chỉ define rõ spec cho gmail
    if (name === 'gmail') {
      // Validate và normalize config bằng parseGmailConfig
      const cfg = parseGmailConfig(JSON.stringify(body))
      const json = JSON.stringify(cfg)

      const mod = await moduleService.updateModuleConfig(name, json)
      return NextResponse.json({ success: true, module: mod })
    }

    return NextResponse.json(
      { success: false, error: 'Config for this module is not implemented yet' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating module config:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

