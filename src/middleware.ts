import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware - Minimal implementation
 * 
 * NOTE: We cannot initialize core services here because:
 * - Middleware runs in Edge Runtime (Vercel Edge Functions)
 * - Prisma Client cannot run in Edge Runtime
 * 
 * Core services will be initialized lazily in API routes (Node.js runtime)
 */
export async function middleware(request: NextRequest) {
  // Just pass through - no initialization in middleware
  // Core services are initialized in API routes when needed
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}

