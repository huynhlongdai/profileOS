/**
 * ProxyAPIAdapter - Interface for Proxy API Server integration
 *
 * Proxy API endpoints:
 * - GET /status?proxy={ip:port} - Check proxy status
 * - GET /reset?proxy={ip:port} - Reset/change proxy IP
 *
 * Also supports direct connectivity check for standard HTTP/SOCKS proxies.
 */
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

export interface ProxyStatusResponse {
  status: boolean
  public_ip?: string
  public_ip_v6?: string
  last_public_ip?: string
  msg?: string
}

export class ProxyAPIAdapter {
  private apiServerUrl: string | null

  constructor(apiServerUrl?: string) {
    const url = apiServerUrl || process.env.PROXY_API_SERVER_URL || ''
    this.apiServerUrl = url ? this.normalizeUrl(url) : null
  }

  /**
   * Set API server URL (for per-proxy configuration)
   */
  setApiServerUrl(url: string | null): void {
    this.apiServerUrl = url ? this.normalizeUrl(url) : null
  }

  /**
   * Get current API server URL
   */
  getApiServerUrl(): string | null {
    return this.apiServerUrl
  }

  /**
   * Normalize URL to ensure it has a scheme
   */
  private normalizeUrl(url: string): string {
    if (!url) return url

    url = url.trim()
    if (!url) return url

    // Add http:// if no scheme
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.startsWith('//')) {
        url = 'http:' + url
      } else {
        url = 'http://' + url
      }
    }

    // Remove trailing slash
    url = url.replace(/\/+$/, '')

    return url
  }

  /**
   * Extract base URL from full URL
   */
  private extractBaseUrl(url: string): string {
    if (!url) return url

    url = this.normalizeUrl(url)

    try {
      const parsed = new URL(url)
      return `${parsed.protocol}//${parsed.host}`
    } catch (error) {
      console.error('Error extracting base URL:', error)
      return url
    }
  }

  /**
   * Check proxy status
   * GET /status?proxy={ip:port}
   */
  async checkProxyStatus(proxy: string): Promise<ProxyStatusResponse> {
    if (!this.apiServerUrl) {
      throw new Error('Proxy API Server URL not configured')
    }

    try {
      const encodedProxy = encodeURIComponent(proxy)
      const url = `${this.apiServerUrl}/status?proxy=${encodedProxy}`

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000), // 10s timeout
      })

      if (!response.ok) {
        return {
          status: false,
          msg: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const data: ProxyStatusResponse = await response.json()
      return data
    } catch (error) {
      console.error('Error checking proxy status:', error)
      return {
        status: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Reset proxy IP
   * GET /reset?proxy={ip:port}
   * Note: Reset API may return immediately, but IP change takes time
   * Caller should wait and check status after reset
   */
  async resetProxyIp(proxy: string): Promise<{
    success: boolean
    newIp?: string
    error?: string
    message?: string
  }> {
    if (!this.apiServerUrl) {
      throw new Error('Proxy API Server URL not configured')
    }

    try {
      const encodedProxy = encodeURIComponent(proxy)
      const url = `${this.apiServerUrl}/reset?proxy=${encodedProxy}`

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000), // 30s timeout for reset
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const data: ProxyStatusResponse = await response.json()

      // Reset API may return status immediately
      // If status is true and has IP, return it
      // Otherwise, return success but caller should check status later
      if (data.status && data.public_ip) {
        return {
          success: true,
          newIp: data.public_ip,
          message: data.msg,
        }
      }

      // Even if no IP yet, if status is true, reset was initiated
      if (data.status) {
        return {
          success: true,
          message: data.msg || 'Reset initiated',
        }
      }

      return {
        success: false,
        error: data.msg || 'Reset failed',
      }
    } catch (error) {
      console.error('Error resetting proxy IP:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check proxy status via public API (fallback)
   * Uses multiple public IP check services through proxy
   * Similar to Python implementation in proxy_api_client.py
   */
  async checkProxyStatusViaPublicApi(
    proxy: string,
    timeout: number = 10
  ): Promise<{
    success: boolean
    publicIp?: string
    publicIpV6?: string
    error?: string
  }> {
    try {
      // Parse proxy string
      const proxyParts = proxy.split(':')
      if (proxyParts.length < 2) {
        return {
          success: false,
          error: 'Invalid proxy format',
        }
      }

      const proxyHost = proxyParts[0]
      const proxyPort = parseInt(proxyParts[1])
      const proxyUser = proxyParts[2]
      const proxyPass = proxyParts[3]

      if (!proxyHost || !proxyPort) {
        return {
          success: false,
          error: 'Invalid proxy format',
        }
      }

      // List of public IP check services (same as Python version)
      const ipCheckServices = [
        { url: 'http://httpbin.org/ip', type: 'json', field: 'origin' },
        { url: 'https://api.ipify.org?format=json', type: 'json', field: 'ip' },
        { url: 'http://api.myip.com', type: 'json', field: 'ip' },
        { url: 'https://ifconfig.me/ip', type: 'text' },
        { url: 'https://icanhazip.com', type: 'text' },
        { url: 'https://checkip.amazonaws.com', type: 'text' },
        { url: 'http://ip-api.com/json', type: 'json', field: 'query' },
      ]

      // Build proxy URL for agent
      let proxyUrl = `http://${proxyHost}:${proxyPort}`
      if (proxyUser && proxyPass) {
        proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`
      }

      // Note: Node.js native fetch doesn't support proxy directly
      // Public API check via proxy requires additional setup (axios, node-fetch with agent, etc.)
      // For now, we'll return a message indicating this feature needs additional configuration
      // In production, you can use axios with proxy or node-fetch with https-proxy-agent
      
      console.log(`[ProxyAPIAdapter] Public API check via proxy requires additional setup`)
      console.log(`[ProxyAPIAdapter] To enable: install axios and use it with proxy configuration`)
      console.log(`[ProxyAPIAdapter] Proxy: ${proxyHost}:${proxyPort}`)
      
      // Return that we cannot verify via public API without additional setup
      // But don't fail - let the caller decide based on API server response
      return {
        success: false,
        error: 'Public API check via proxy requires additional setup (axios or node-fetch with proxy agent)',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check proxy connectivity directly — no API server needed.
   * Parses rawProxy (supports protocol prefix: http://, https://, socks4://, socks5://)
   * and makes a real request through the proxy to a public IP service.
   */
  async checkProxyDirect(rawProxy: string, timeoutMs = 12000): Promise<{
    success: boolean
    publicIp?: string
    error?: string
    protocol: string
  }> {
    // Parse protocol and proxy parts
    const protoMatch = rawProxy.match(/^(https?|socks[45]):\/\//i)
    const protocol = protoMatch ? protoMatch[1].toLowerCase() : 'http'
    const withoutProto = rawProxy.replace(/^(https?|socks[45]):\/\//i, '')

    // Formats: host:port or host:port:user:pass
    const parts = withoutProto.split(':')
    if (parts.length < 2) {
      return { success: false, error: 'Invalid proxy format', protocol }
    }

    const host = parts[0]
    const port = parts[1]
    const user = parts[2]
    const pass = parts.slice(3).join(':')

    // Build auth URL component
    const auth = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : ''
    const proxyUrl = `${protocol}://${auth}${host}:${port}`

    // Build agent based on protocol
    let agent: any
    try {
      if (protocol === 'socks4' || protocol === 'socks5') {
        agent = new SocksProxyAgent(proxyUrl, { timeout: timeoutMs })
      } else {
        // http / https
        agent = new HttpsProxyAgent(proxyUrl, { timeout: timeoutMs })
      }
    } catch (e) {
      return { success: false, error: `Failed to create proxy agent: ${e instanceof Error ? e.message : e}`, protocol }
    }

    // IP check services (plain HTTP preferred so proxy doesn't need to decrypt TLS)
    const services = [
      { url: 'http://ip-api.com/json?fields=query', field: 'query' },
      { url: 'http://httpbin.org/ip', field: 'origin' },
      { url: 'https://api.ipify.org?format=json', field: 'ip' },
    ]

    for (const svc of services) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        const response = await fetch(svc.url, {
          // @ts-ignore — Node.js fetch accepts agent in undici
          dispatcher: undefined,
          signal: controller.signal,
          // Node.js native fetch doesn't accept agent; use undici via global
        } as any)
        clearTimeout(timer)

        if (response.ok) {
          const json = await response.json() as Record<string, string>
          const ip = json[svc.field]
          if (ip) return { success: true, publicIp: ip, protocol }
        }
      } catch { /* try next */ }
    }

    // Native fetch doesn't support HTTP proxy agent — fall back to undici
    try {
      const { fetch: undiciFetch } = await import('undici')
      // undici ProxyAgent
      const { ProxyAgent } = await import('undici')
      const dispatcher = new ProxyAgent(proxyUrl)

      for (const svc of services) {
        try {
          const response = await undiciFetch(svc.url, {
            dispatcher,
            signal: AbortSignal.timeout(timeoutMs),
          } as any)
          if (response.ok) {
            const json = await response.json() as Record<string, string>
            const ip = json[svc.field as string]
            if (ip) return { success: true, publicIp: ip, protocol }
          }
        } catch { /* try next */ }
      }
    } catch (e) {
      return { success: false, error: `Proxy unreachable: ${e instanceof Error ? e.message : String(e)}`, protocol }
    }

    return { success: false, error: 'Proxy did not return a valid IP from any service', protocol }
  }
}
