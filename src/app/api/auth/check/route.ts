import { NextResponse } from 'next/server'
import { isAuthenticated, isAuthEnabled } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isAuthEnabled()) {
    return NextResponse.json({ authenticated: true, authEnabled: false })
  }

  const authenticated = await isAuthenticated()
  return NextResponse.json({ authenticated, authEnabled: true })
}
