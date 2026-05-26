import { NextRequest, NextResponse } from 'next/server'
import { ProxyService } from '@/core/services/ProxyService'

const proxyService = new ProxyService()

export type ProxyType = 'http' | 'https' | 'socks4' | 'socks5'

interface ParsedProxy {
  host: string
  port: string
  username?: string
  password?: string
}

/**
 * Parse a proxy string in common formats:
 * - host:port
 * - host:port:user:pass
 * - user:pass@host:port
 * - protocol://host:port
 * - protocol://user:pass@host:port
 */
function parseProxyLine(line: string): ParsedProxy | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  // Strip protocol prefix (http://, socks5://, etc.) — we handle type separately
  let str = trimmed.replace(/^(https?|socks[45]):\/\//i, '')

  // Format: user:pass@host:port
  if (str.includes('@')) {
    const atIdx = str.lastIndexOf('@')
    const credentials = str.substring(0, atIdx)
    const hostPart = str.substring(atIdx + 1)
    const credParts = credentials.split(':')
    const [host, port] = hostPart.split(':')
    if (host && port && credParts.length >= 2) {
      const username = credParts[0]
      const password = credParts.slice(1).join(':')
      return { host, port, username, password }
    }
    return null
  }

  // Format: host:port or host:port:user:pass
  const parts = str.split(':')
  if (parts.length === 2) {
    const [host, port] = parts
    if (host && port && /^\d+$/.test(port)) return { host, port }
  } else if (parts.length >= 4) {
    const host = parts[0]
    const port = parts[1]
    const username = parts[2]
    const password = parts.slice(3).join(':')
    if (host && port && /^\d+$/.test(port)) return { host, port, username, password }
  }

  return null
}

/**
 * Build rawProxy string for storage: type://host:port or type://host:port:user:pass
 */
function buildRawProxy(parsed: ParsedProxy, proxyType: ProxyType): string {
  if (parsed.username && parsed.password) {
    return `${proxyType}://${parsed.host}:${parsed.port}:${parsed.username}:${parsed.password}`
  }
  return `${proxyType}://${parsed.host}:${parsed.port}`
}

/**
 * Build the proxy URL with protocol prefix (used internally / for GPM)
 */
function buildProxyUrl(parsed: ParsedProxy, proxyType: ProxyType): string {
  if (parsed.username && parsed.password) {
    return `${proxyType}://${parsed.username}:${parsed.password}@${parsed.host}:${parsed.port}`
  }
  return `${proxyType}://${parsed.host}:${parsed.port}`
}

/**
 * POST /api/proxies/bulk
 * Body: { proxyType: 'http'|'https'|'socks4'|'socks5', proxies: string, proxyServerUrl?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { proxyType = 'http', proxies: rawText, proxyServerUrl } = body as {
      proxyType: ProxyType
      proxies: string
      proxyServerUrl?: string
    }

    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json({ success: false, error: 'proxies text is required' }, { status: 400 })
    }

    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)

    const results: { line: string; success: boolean; label?: string; error?: string }[] = []
    let successCount = 0
    let failCount = 0
    let duplicateCount = 0

    for (const line of lines) {
      const parsed = parseProxyLine(line)
      if (!parsed) {
        results.push({ line, success: false, error: 'Invalid format' })
        failCount++
        continue
      }

      const rawProxy = buildRawProxy(parsed, proxyType)
      // Auto-generate a label from type + host:port
      const label = `${proxyType.toUpperCase()} ${parsed.host}:${parsed.port}`

      try {
        await proxyService.createProxy({
          label,
          rawProxy,
          proxyServerUrl: proxyServerUrl || undefined,
        })
        results.push({ line, success: true, label })
        successCount++
      } catch (err: any) {
        // Handle unique constraint violation (duplicate) - Prisma P2002
        if (err?.code === 'P2002') {
          results.push({ line, success: false, error: 'Duplicate (already exists)' })
          duplicateCount++
        } else {
          results.push({ line, success: false, error: err?.message || 'Unknown error' })
          failCount++
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: lines.length,
        imported: successCount,
        duplicates: duplicateCount,
        failed: failCount,
      },
      results,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
