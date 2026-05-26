import { cookies } from 'next/headers'
import { createHash } from 'crypto'

const AUTH_COOKIE = 'profileos_session'
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

function getPassword(): string {
  return process.env.AUTH_PASSWORD || ''
}

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function generateSessionToken(password: string): string {
  const timestamp = Date.now().toString()
  return hashToken(`${password}:${timestamp}:${process.env.AUTH_PASSWORD}`)
}

export function validatePassword(password: string): boolean {
  const expected = getPassword()
  if (!expected) return true // No password set = no auth required
  return password === expected
}

export function isAuthEnabled(): boolean {
  return !!process.env.AUTH_PASSWORD
}

export async function isAuthenticated(): Promise<boolean> {
  if (!isAuthEnabled()) return true
  const cookieStore = await cookies()
  const session = cookieStore.get(AUTH_COOKIE)
  if (!session) return false
  // Verify session token format: token:expiry
  const parts = session.value.split(':')
  if (parts.length !== 2) return false
  const expiry = parseInt(parts[1])
  if (Date.now() > expiry) return false
  return true
}

export function createSessionCookie(token: string): { name: string; value: string; options: Record<string, unknown> } {
  const expiry = Date.now() + SESSION_DURATION
  return {
    name: AUTH_COOKIE,
    value: `${token}:${expiry}`,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION / 1000,
    },
  }
}

export function deleteSessionCookie(): { name: string; value: string; options: Record<string, unknown> } {
  return {
    name: AUTH_COOKIE,
    value: '',
    options: {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    },
  }
}
