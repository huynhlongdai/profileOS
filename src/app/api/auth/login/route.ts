import { NextRequest, NextResponse } from 'next/server'
import { validatePassword, generateSessionToken, createSessionCookie, isAuthEnabled } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ success: true, message: 'Auth not enabled' })
  }

  try {
    const { password } = await req.json()

    if (!validatePassword(password)) {
      return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 })
    }

    const token = generateSessionToken(password)
    const cookie = createSessionCookie(token)

    const response = NextResponse.json({ success: true })
    response.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof response.cookies.set>[2])

    return response
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  }
}
