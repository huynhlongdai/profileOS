import { prisma } from '@/lib/prisma'
import { LogService } from './LogService'
import { ProxyAPIAdapter } from '@/integrations/ProxyAPIAdapter'
import type { Proxy, Prisma } from '@prisma/client'

export interface CheckProxyResult {
  status: 'active' | 'dead' | 'error'
  publicIp?: string
  publicIpV6?: string
  message?: string
}

export class ProxyService {
  private logService: LogService
  private proxyAdapter: ProxyAPIAdapter

  constructor() {
    this.logService = new LogService()
    this.proxyAdapter = new ProxyAPIAdapter()
  }

  /**
   * List all proxies with optional filters
   */
  async listProxies(filter?: { status?: string }): Promise<Proxy[]> {
    const where: Prisma.ProxyWhereInput = {}
    if (filter?.status) where.status = filter.status

    return prisma.proxy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            accounts: true,
            profiles: true,
          },
        },
      },
    })
  }

  /**
   * Get proxy by ID
   */
  async getProxy(id: string): Promise<Proxy | null> {
    return prisma.proxy.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            accounts: true,
            profiles: true,
          },
        },
      },
    })
  }

  /**
   * Create a new proxy
   */
  async createProxy(payload: {
    label: string
    rawProxy: string
    proxyServerUrl?: string
    ipBefore?: string
  }): Promise<Proxy> {
    const proxy = await prisma.proxy.create({
      data: {
        label: payload.label,
        rawProxy: payload.rawProxy,
        proxyServerUrl: payload.proxyServerUrl || null,
        ipBefore: payload.ipBefore || null,
        status: 'active',
      },
    })

    await this.logService.logInfo('core', `Proxy created: ${payload.label}`, { proxyId: proxy.id })
    return proxy
  }

  /**
   * Update proxy
   */
  async updateProxy(id: string, payload: Partial<{
    label: string
    rawProxy: string
    proxyServerUrl?: string
    status: string
  }>): Promise<Proxy> {
    const proxy = await prisma.proxy.update({
      where: { id },
      data: payload,
    })

    await this.logService.logInfo('core', `Proxy updated: ${id}`, { proxyId: id })
    return proxy
  }

  /**
   * Delete proxy
   */
  async deleteProxy(id: string): Promise<void> {
    await prisma.proxy.delete({
      where: { id },
    })

    await this.logService.logInfo('core', `Proxy deleted: ${id}`, { proxyId: id })
  }

  /**
   * Check proxy status.
   * - If rawProxy has a protocol prefix (http://, socks5://, etc.) → direct connectivity check
   *   (no API server required; connects through the proxy to a public IP service)
   * - Otherwise → uses Proxy API Server (modem/rotation proxy management API)
   */
  async checkProxy(id: string): Promise<CheckProxyResult> {
    const proxy = await this.getProxy(id)
    if (!proxy) throw new Error('Proxy not found')

    // Detect if this is a standard proxy (has protocol prefix) vs modem proxy (needs API server)
    const hasProtocolPrefix = /^(https?|socks[45]):\/\//i.test(proxy.rawProxy)
    const hasApiServer = !!(proxy.proxyServerUrl || process.env.PROXY_API_SERVER_URL)

    // Update status to checking
    await prisma.proxy.update({ where: { id }, data: { status: 'checking' } })

    // ── Direct check (HTTP / SOCKS proxies) ───────────────────
    if (hasProtocolPrefix && !hasApiServer) {
      try {
        const adapter = new ProxyAPIAdapter()
        const result = await adapter.checkProxyDirect(proxy.rawProxy)

        const status: 'active' | 'dead' | 'error' = result.success ? 'active' : 'dead'

        console.log(`[ProxyService] Direct check ${proxy.label}: ${status} – IP: ${result.publicIp ?? 'N/A'} – ${result.error ?? ''}`)

        const updateData: Record<string, unknown> = { lastCheck: new Date(), status }
        if (result.publicIp) {
          if (proxy.ipAfter && proxy.ipAfter !== result.publicIp) updateData.ipBefore = proxy.ipAfter
          updateData.ipAfter = result.publicIp
        }
        await prisma.proxy.update({ where: { id }, data: updateData })

        const logLevel = status === 'active' ? 'logInfo' : 'logWarning'
        await this.logService[logLevel]('core', `Proxy checked (direct): ${proxy.label} – ${status}`, {
          proxyId: id, status, publicIp: result.publicIp, protocol: result.protocol,
        })

        return {
          status,
          publicIp: result.publicIp,
          message: result.error ?? (status === 'active' ? `OK via ${result.protocol}` : 'Unreachable'),
        }
      } catch (error) {
        await prisma.proxy.update({ where: { id }, data: { status: 'error', lastCheck: new Date() } })
        await this.logService.logError('core', `Error checking proxy: ${proxy.label}`, {
          proxyId: id, error: error instanceof Error ? error.message : String(error),
        })
        return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }
      }
    }

    // ── Modem / API server check ───────────────────────────────
    const adapter = proxy.proxyServerUrl
      ? new ProxyAPIAdapter(proxy.proxyServerUrl)
      : this.proxyAdapter

    try {
      const result = await adapter.checkProxyStatus(proxy.rawProxy)

      console.log(`[ProxyService] Check proxy ${proxy.label} response:`, {
        status: result.status, public_ip: result.public_ip, msg: result.msg,
      })

      let status: 'active' | 'dead' | 'error' = 'dead'
      let shouldVerifyViaPublicApi = false

      if (result.status === true) {
        if (result.msg === 'MODEM_READY') {
          status = 'active'
        } else if (result.msg === 'COLLISION_IP') {
          if (result.public_ip) { shouldVerifyViaPublicApi = true }
          else { status = 'error' }
        } else if (['MODEM_RESETTING', 'MODEM_NOT_FOUND', 'MODEM_DISCONNECTED'].includes(result.msg ?? '')) {
          status = 'dead'
        } else {
          status = result.public_ip ? 'active' : 'dead'
        }
      } else if (result.status === false) {
        status = 'dead'
      } else {
        status = 'error'
      }

      if (shouldVerifyViaPublicApi && result.public_ip) {
        try {
          const pub = await adapter.checkProxyStatusViaPublicApi(proxy.rawProxy, 10)
          status = 'active'
          if (pub.success && pub.publicIp) {
            await this.logService.logWarning('core', `Proxy ${proxy.label} has COLLISION_IP but works via public API`, {
              proxyId: id, publicIp: result.public_ip, verifiedIp: pub.publicIp,
            })
          }
        } catch { status = 'active' }
      }

      const updateData: Record<string, unknown> = { lastCheck: new Date(), status }
      if (result.public_ip) {
        if (proxy.ipAfter && proxy.ipAfter !== result.public_ip) updateData.ipBefore = proxy.ipAfter
        updateData.ipAfter = result.public_ip
      }
      await prisma.proxy.update({ where: { id }, data: updateData })

      const logLevel = status === 'error' ? 'logError' : status === 'dead' ? 'logWarning' : 'logInfo'
      await this.logService[logLevel]('core', `Proxy checked: ${proxy.label} – Status: ${status}`, {
        proxyId: id, status, publicIp: result.public_ip, message: result.msg,
      })

      return { status, publicIp: result.public_ip, publicIpV6: result.public_ip_v6, message: result.msg }
    } catch (error) {
      await prisma.proxy.update({ where: { id }, data: { status: 'error', lastCheck: new Date() } })
      await this.logService.logError('core', `Error checking proxy: ${proxy.label}`, {
        proxyId: id, error: error instanceof Error ? error.message : String(error),
      })
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }


  /**
   * Reset proxy IP
   * After reset, waits and checks the new IP
   */
  async resetProxyIp(id: string): Promise<CheckProxyResult> {
    const proxy = await this.getProxy(id)
    if (!proxy) {
      throw new Error('Proxy not found')
    }

    // Use proxy-specific server URL if available
    const adapter = proxy.proxyServerUrl
      ? new ProxyAPIAdapter(proxy.proxyServerUrl)
      : this.proxyAdapter

    try {
      await this.logService.logInfo('core', `Starting proxy IP reset: ${proxy.label}`, {
        proxyId: id,
      })

      // Save current IP as ipBefore
      const ipBefore = proxy.ipAfter || proxy.ipBefore

      // Call reset API
      const resetResult = await adapter.resetProxyIp(proxy.rawProxy)

      if (!resetResult.success) {
        throw new Error(resetResult.error || 'Failed to reset proxy IP')
      }

      // Update lastReset timestamp
      await prisma.proxy.update({
        where: { id },
        data: {
          lastReset: new Date(),
          ipBefore: ipBefore,
        },
      })

      await this.logService.logInfo('core', `Proxy IP reset initiated: ${proxy.label}`, {
        proxyId: id,
      })

      // Wait for reset to complete (modem needs time to reset)
      // Wait 5-10 seconds before checking
      const waitTime = 5000 + Math.random() * 5000 // 5-10 seconds
      await new Promise((resolve) => setTimeout(resolve, waitTime))

      // Now check the proxy to get the new IP
      await this.logService.logInfo('core', `Checking proxy after reset: ${proxy.label}`, {
        proxyId: id,
      })

      // Retry checking up to 3 times with delays
      let apiResult: any = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          apiResult = await adapter.checkProxyStatus(proxy.rawProxy)

          // If we got a valid IP and status is ready, break
          if (apiResult.public_ip && apiResult.msg === 'MODEM_READY') {
            break
          }

          // If still resetting, wait more
          if (apiResult.msg === 'MODEM_RESETTING') {
            await new Promise((resolve) => setTimeout(resolve, 5000))
            continue
          }

          // If ready (even without IP yet), break
          if (apiResult.msg === 'MODEM_READY') {
            break
          }

          // If we have an IP, break even if message is different
          if (apiResult.public_ip) {
            break
          }
        } catch (error) {
          if (attempt === 3) {
            throw error
          }
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      }

      if (!apiResult) {
        throw new Error('Failed to check proxy after reset')
      }

      // Determine status
      let status: 'active' | 'dead' | 'error' = 'dead'
      if (apiResult.status) {
        if (apiResult.msg === 'MODEM_READY') {
          status = 'active'
        } else if (apiResult.msg === 'MODEM_RESETTING' || apiResult.msg === 'MODEM_NOT_FOUND' || apiResult.msg === 'MODEM_DISCONNECTED') {
          status = 'dead'
        } else if (apiResult.msg === 'COLLISION_IP') {
          status = 'error'
        } else {
          status = apiResult.status ? 'active' : 'dead'
        }
      }

      // Convert to CheckProxyResult
      const checkResult: CheckProxyResult = {
        status,
        publicIp: apiResult.public_ip,
        publicIpV6: apiResult.public_ip_v6,
        message: apiResult.msg,
      }

      // Update proxy with new IP and status
      const updateData: any = {
        lastReset: new Date(),
        lastCheck: new Date(),
        status,
        ipBefore: ipBefore,
      }

      if (checkResult.publicIp) {
        updateData.ipAfter = checkResult.publicIp
      }

      await prisma.proxy.update({
        where: { id },
        data: updateData,
      })

      await this.logService.logInfo('core', `Proxy IP reset completed: ${proxy.label}`, {
        proxyId: id,
        newIp: checkResult.publicIp,
        status,
        message: checkResult.message,
      })

      return checkResult
    } catch (error) {
      await prisma.proxy.update({
        where: { id },
        data: {
          status: 'error',
          lastReset: new Date(),
        },
      })

      await this.logService.logError('core', `Error resetting proxy IP: ${proxy.label}`, {
        proxyId: id,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   * Assign proxy to account
   */
  async assignProxyToAccount(proxyId: string, accountId: string): Promise<void> {
    await prisma.account.update({
      where: { id: accountId },
      data: { proxyId },
    })

    await this.logService.logInfo('core', `Proxy assigned to account`, {
      proxyId,
      accountId,
    })
  }

  /**
   * Assign proxy to profile
   */
  async assignProxyToProfile(proxyId: string, profileId: string): Promise<void> {
    await prisma.profile.update({
      where: { id: profileId },
      data: { proxyId },
    })

    await this.logService.logInfo('core', `Proxy assigned to profile`, {
      proxyId,
      profileId,
    })
  }

  /**
   * Auto pick proxy for account (selects unused or least used proxy)
   */
  async autoPickProxyForAccount(accountId: string): Promise<string | null> {
    // Find proxy with least accounts assigned
    const proxies = await prisma.proxy.findMany({
      where: { status: 'active' },
      include: {
        _count: {
          select: { accounts: true },
        },
      },
      orderBy: {
        accounts: {
          _count: 'asc',
        },
      },
      take: 1,
    })

    if (proxies.length === 0) {
      return null
    }

    const proxyId = proxies[0].id
    await this.assignProxyToAccount(proxyId, accountId)
    return proxyId
  }
}

