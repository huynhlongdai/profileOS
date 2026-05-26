import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CONFIG_KEY = 'google_sheets_config'

export interface GoogleSheetsConfig {
  gasWebAppUrl: string
  secretToken: string
  lastSync?: string
  autoSync?: boolean
  autoSyncIntervalMinutes?: number
}

/**
 * GET /api/google-sheets/config
 */
export async function GET() {
  try {
    const record = await prisma.appConfig.findUnique({ where: { key: CONFIG_KEY } })
    if (!record) {
      return NextResponse.json({ success: true, config: null })
    }
    const config = JSON.parse(record.valueJson) as GoogleSheetsConfig
    return NextResponse.json({ success: true, config })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/google-sheets/config
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<GoogleSheetsConfig>

    if (!body.gasWebAppUrl) {
      return NextResponse.json({ success: false, error: 'gasWebAppUrl is required' }, { status: 400 })
    }

    // Load existing config to preserve lastSync
    let existing: GoogleSheetsConfig | null = null
    const existingRecord = await prisma.appConfig.findUnique({ where: { key: CONFIG_KEY } })
    if (existingRecord) {
      existing = JSON.parse(existingRecord.valueJson)
    }

    const config: GoogleSheetsConfig = {
      gasWebAppUrl: body.gasWebAppUrl,
      secretToken: body.secretToken || '',
      lastSync: existing?.lastSync,
      autoSync: body.autoSync ?? false,
      autoSyncIntervalMinutes: body.autoSyncIntervalMinutes ?? 60,
    }

    await prisma.appConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { valueJson: JSON.stringify(config) },
      create: { key: CONFIG_KEY, valueJson: JSON.stringify(config) },
    })

    return NextResponse.json({ success: true, config })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
