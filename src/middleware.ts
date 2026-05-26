import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE = 'profileos_session'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/',
  '/api/agent/',
  '/_next/',
  '/favicon.ico',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth check for public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check if auth is enabled
  const authPassword = process.env.AUTH_PASSWORD
  if (!authPassword) {
    return NextResponse.next()
  }

  // Check session cookie
  const session = request.cookies.get(AUTH_COOKIE)
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verify session not expired
  const parts = session.value.split(':')
  if (parts.length !== 2) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const expiry = parseInt(parts[1])
  if (Date.now() > expiry) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete(AUTH_COOKIE)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
