import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GoogleSheetsConfig } from '../config/route'

const CONFIG_KEY = 'google_sheets_config'

interface AccountRow {
  index: number
  label: string
  accountType: string
  identifier: string
  status: string
  notes: string
  profileName: string
  proxyLabel: string
  lastLogin: string
  updatedAt: string
}

interface ProfileRow {
  index: number
  name: string
  status: string
  browserProvider: string
  proxyLabel: string
  groupId: string
  lastOpened: string
  updatedAt: string
}

/**
 * POST /api/google-sheets/push
 * Đọc dữ liệu Accounts + Profiles từ DB, push lên GAS Web App
 */
export async function POST(request: NextRequest) {
  try {
    // Đọc config
    const configRecord = await prisma.appConfig.findUnique({ where: { key: CONFIG_KEY } })
    if (!configRecord) {
      return NextResponse.json(
        { success: false, error: 'Chưa cấu hình Google Sheets. Vào Settings > Google Sheets để thiết lập.' },
        { status: 400 }
      )
    }

    const config = JSON.parse(configRecord.valueJson) as GoogleSheetsConfig
    if (!config.gasWebAppUrl) {
      return NextResponse.json(
        { success: false, error: 'GAS Web App URL chưa được cấu hình.' },
        { status: 400 }
      )
    }

    // Đọc tất cả accounts (kèm profile và proxy)
    const accounts = await prisma.account.findMany({
      include: {
        profile: { select: { name: true } },
        proxy: { select: { label: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Đọc tất cả profiles (kèm proxy)
    const profiles = await prisma.profile.findMany({
      include: {
        proxy: { select: { label: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Format account rows
    const accountRows: AccountRow[] = accounts.map((acc, i) => ({
      index: i + 1,
      label: acc.label || '',
      accountType: acc.accountType || '',
      identifier: acc.identifier || '',
      status: acc.status || '',
      notes: acc.notes || '',
      profileName: acc.profile?.name || '',
      proxyLabel: acc.proxy?.label || '',
      lastLogin: acc.lastLogin ? acc.lastLogin.toISOString() : '',
      updatedAt: acc.updatedAt.toISOString(),
    }))

    // Format profile rows
    const profileRows: ProfileRow[] = profiles.map((prof, i) => ({
      index: i + 1,
      name: prof.name || '',
      status: prof.status || '',
      browserProvider: prof.browserProvider || '',
      proxyLabel: prof.proxy?.label || '',
      groupId: prof.groupId ? String(prof.groupId) : '',
      lastOpened: prof.lastOpened ? prof.lastOpened.toISOString() : '',
      updatedAt: prof.updatedAt.toISOString(),
    }))

    const payload = {
      secretToken: config.secretToken || '',
      timestamp: new Date().toISOString(),
      accounts: accountRows,
      profiles: profileRows,
    }

    // Push lên GAS Web App
    const gasUrl = config.gasWebAppUrl
    const gasResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!gasResponse.ok) {
      const errorText = await gasResponse.text()
      return NextResponse.json(
        { success: false, error: `GAS trả về lỗi ${gasResponse.status}: ${errorText}` },
        { status: 502 }
      )
    }

    const gasResult = await gasResponse.json().catch(() => ({ status: 'ok' }))

    // Cập nhật lastSync trong config
    const updatedConfig: GoogleSheetsConfig = {
      ...config,
      lastSync: new Date().toISOString(),
    }
    await prisma.appConfig.update({
      where: { key: CONFIG_KEY },
      data: { valueJson: JSON.stringify(updatedConfig) },
    })

    return NextResponse.json({
      success: true,
      pushed: {
        accounts: accountRows.length,
        profiles: profileRows.length,
        timestamp: updatedConfig.lastSync,
      },
      gasResult,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
