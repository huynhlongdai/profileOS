import { prisma } from '@/lib/prisma'
import { LogService } from './LogService'
import { GpmLoginAdapter } from '@/integrations/GpmLoginAdapter'
import { ChromeProfileAdapter } from '@/integrations/ChromeProfileAdapter'
import { FirefoxProfileAdapter } from '@/integrations/FirefoxProfileAdapter'
import { ChangeHistoryService } from './ChangeHistoryService'
import type { Profile, Prisma } from '@prisma/client'
import * as path from 'path'

export class ProfileService {
  private logService: LogService
  private chromeAdapter: ChromeProfileAdapter
  private firefoxAdapter: FirefoxProfileAdapter
  private changeHistoryService: ChangeHistoryService

  constructor() {
    this.logService = new LogService()
    this.chromeAdapter = new ChromeProfileAdapter()
    this.firefoxAdapter = new FirefoxProfileAdapter()
    this.changeHistoryService = new ChangeHistoryService()
  }

  private connectionToAdapter(connection: { apiUrl: string; apiVersion: string }): GpmLoginAdapter {
    return new GpmLoginAdapter(connection.apiUrl, connection.apiVersion)
  }

  /**
   * Lấy GpmLoginAdapter từ cài đặt BrowserConnection (DB), không dùng URL cũ trong .env
   */
  private async getGpmAdapterForProvider(provider: string): Promise<GpmLoginAdapter> {
    const builtinId = provider === 'gpmlogin_global' ? 'global-gpm' : 'local-gpm'

    const byBuiltinId = await prisma.browserConnection.findFirst({
      where: { id: builtinId, isEnabled: true },
    })
    if (byBuiltinId) {
      return this.connectionToAdapter(byBuiltinId)
    }

    const byDefault = await prisma.browserConnection.findFirst({
      where: { providerType: provider, isDefault: true, isEnabled: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (byDefault) {
      return this.connectionToAdapter(byDefault)
    }

    const anyForProvider = await prisma.browserConnection.findFirst({
      where: { providerType: provider, isEnabled: true },
      orderBy: { createdAt: 'asc' },
    })
    if (anyForProvider) {
      return this.connectionToAdapter(anyForProvider)
    }

    return new GpmLoginAdapter()
  }

  /**
   * GpmLoginAdapter cho profile — ưu tiên browserConnectionId, sau đó provider
   */
  private async getGpmAdapterForProfile(profileId: string): Promise<GpmLoginAdapter> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { connection: true },
    })

    if (!profile) {
      return this.getGpmAdapterForProvider('gpmlogin')
    }

    if (profile.browserConnectionId) {
      const conn =
        profile.connection ??
        (await prisma.browserConnection.findUnique({
          where: { id: profile.browserConnectionId },
        }))
      if (conn?.isEnabled) {
        return this.connectionToAdapter(conn)
      }
    }

    const provider = profile.browserProvider || 'gpmlogin'
    if (provider === 'gpmlogin' || provider === 'gpmlogin_global') {
      return this.getGpmAdapterForProvider(provider)
    }

    return this.getGpmAdapterForProvider('gpmlogin')
  }

  /**
   * Lấy GpmLoginAdapter cho một connection ID cụ thể
   */
  private async getGpmAdapterForConnection(connectionId: string): Promise<GpmLoginAdapter> {
    const connection = await prisma.browserConnection.findUnique({
      where: { id: connectionId },
    })

    if (connection?.isEnabled) {
      return this.connectionToAdapter(connection)
    }

    return this.getGpmAdapterForProvider('gpmlogin')
  }

  /**
   * Find or create proxy by rawProxy string
   * Returns proxy ID or null if rawProxy is empty
   */
  private async findOrCreateProxy(rawProxy: string | undefined | null): Promise<string | null> {
    if (!rawProxy || rawProxy.trim() === '') {
      return null
    }

    // Handle GPMLogin proxy format: "HTTP proxy| IP:Port" or just "IP:Port"
    let proxyString = rawProxy.trim()

    // Extract proxy from format "HTTP proxy| IP:Port" (GPMLogin format)
    if (proxyString.includes('|')) {
      const parts = proxyString.split('|')
      if (parts.length > 1) {
        proxyString = parts[parts.length - 1].trim() // Take the last part after |
      }
    }

    // Normalize proxy string (remove protocol if present, trim)
    let normalizedProxy = proxyString
    normalizedProxy = normalizedProxy.replace(/^https?:\/\//i, '').replace(/^socks5:\/\//i, '')

    // Try multiple ways to find existing proxy
    // Method 1: Exact match with normalized proxy
    let existing = await prisma.proxy.findFirst({
      where: {
        rawProxy: normalizedProxy || undefined,
      },
    })

    // Method 2: Try with original format
    if (!existing && proxyString !== normalizedProxy) {
      existing = await prisma.proxy.findFirst({
        where: {
          rawProxy: proxyString,
        },
      })
    }

    // Method 3: Try to find by comparing normalized versions (case-insensitive)
    if (!existing) {
      const allProxies = await prisma.proxy.findMany({
        where: {},
      })

      for (const proxy of allProxies) {
        const proxyNormalized = proxy.rawProxy
          .replace(/^https?:\/\//i, '')
          .replace(/^socks5:\/\//i, '')
          .trim()

        if (proxyNormalized.toLowerCase() === normalizedProxy.toLowerCase()) {
          existing = proxy
          break
        }
      }
    }

    if (existing) {
      await this.logService.logInfo('core', `Found existing proxy for GPMLogin sync`, {
        proxyId: existing.id,
        proxyLabel: existing.label,
        gpmProxy: rawProxy,
        normalizedProxy,
      })
      return existing.id
    }

    // Create new proxy if not found
    // Generate label from proxy (e.g., "192.168.1.1:8080" -> "Proxy 192.168.1.1:8080")
    const label = normalizedProxy.length > 50
      ? `Proxy ${normalizedProxy.substring(0, 47)}...`
      : `Proxy ${normalizedProxy}`

    const newProxy = await prisma.proxy.create({
      data: {
        label,
        rawProxy: normalizedProxy,
        status: 'active',
      },
    })

    await this.logService.logInfo('core', `Auto-created proxy from GPMLogin sync: ${label}`, {
      proxyId: newProxy.id,
      gpmProxy: rawProxy,
      normalizedProxy,
    })

    return newProxy.id
  }

  /**
   * Sync profiles from GPMLogin
   * Fetches all profiles from GPMLogin (with pagination if needed) and syncs to database
   * Also syncs proxy information from GPMLogin profiles
   * @param browserTypeFilter Optional filter to sync only profiles of specific browser type ('chromium' | 'firefox' | 'gpm')
   */
  async syncProfilesFromGpm(browserTypeFilter?: 'chromium' | 'firefox' | 'gpm', connectionId?: string, browserProvider?: string): Promise<{ synced: number; total: number }> {
    try {
      // Get the correct adapter
      let adapter = await this.getGpmAdapterForProvider('gpmlogin')
      if (browserProvider) {
        adapter = await this.getGpmAdapterForProvider(browserProvider)
      } else if (connectionId) {
        adapter = await this.getGpmAdapterForConnection(connectionId)
      }

      // Fetch all profiles with pagination
      let allProfiles: any[] = []
      let page = 1
      const perPage = 100
      let hasMore = true

      while (hasMore) {
        const result = await adapter.getProfiles(page, perPage)
        allProfiles = [...allProfiles, ...result.profiles]

        // Check if there are more pages
        if (result.pagination) {
          hasMore = page < result.pagination.total_page
          page++
        } else {
          // If no pagination info, assume we got all if less than perPage
          hasMore = result.profiles.length === perPage
          page++
        }

        // Safety limit: don't fetch more than 1000 pages
        if (page > 1000) {
          console.warn('Reached pagination limit (1000 pages), stopping sync')
          break
        }
      }

      let synced = 0
      let updated = 0
      let proxySynced = 0

      for (const gpmProfile of allProfiles) {
        // Filter by browserType if specified
        if (browserTypeFilter) {
          const rawBrowserType = gpmProfile.browser_type ||
            gpmProfile.browserType ||
            gpmProfile.browser_core ||
            (gpmProfile as any).browserCore ||
            'gpm'
          const normalized = rawBrowserType.toLowerCase().trim()
          let profileBrowserType = 'gpm'
          if (normalized === 'chrome' || normalized === 'chromium' || normalized === 'ch') {
            profileBrowserType = 'chromium'
          } else if (normalized === 'firefox' || normalized === 'ff' || normalized === 'moz') {
            profileBrowserType = 'firefox'
          } else if (normalized === 'gpm' || normalized === 'gpmbrowser') {
            profileBrowserType = 'gpm'
          }

          // Skip if browserType doesn't match filter
          if (profileBrowserType !== browserTypeFilter) {
            continue
          }
        }
        // Check if profile exists
        const existing = await prisma.profile.findUnique({
          where: { profileUid: gpmProfile.id },
        })

        // Parse group_id (can be string or number)
        const groupIdNum = gpmProfile.group_id
          ? typeof gpmProfile.group_id === 'number'
            ? gpmProfile.group_id
            : parseInt(gpmProfile.group_id.toString(), 10)
          : null

        // Get proxy from GPMLogin profile (raw_proxy or proxy field)
        // Try multiple field names that GPMLogin might use
        const gpmProxy = gpmProfile.raw_proxy ||
          gpmProfile.proxy ||
          gpmProfile.rawProxy ||
          (gpmProfile as any).proxy_string ||
          (gpmProfile as any).proxyString ||
          null

        // Log proxy info for debugging
        if (gpmProxy) {
          await this.logService.logInfo('core', `Syncing proxy for profile: ${gpmProfile.name}`, {
            profileUid: gpmProfile.id,
            gpmProxyRaw: gpmProxy,
            hasRawProxy: !!gpmProfile.raw_proxy,
            hasProxy: !!gpmProfile.proxy,
          })
        }

        const proxyId = await this.findOrCreateProxy(gpmProxy)

        // Get browser type from GPMLogin profile
        // Try multiple field names that GPMLogin might use
        const rawBrowserType = gpmProfile.browser_type ||
          gpmProfile.browserType ||
          gpmProfile.browser_core ||
          (gpmProfile as any).browserCore ||
          'gpm' // Default to gpm if not specified

        // Normalize browser type: convert various formats to standard format
        // NOTE: GPMLogin profiles are GPM browser by default, even if API returns "chrome" or "chromium"
        // Only explicitly set to chromium/firefox if GPMLogin explicitly returns those values
        let browserType: string = 'gpm' // Default to GPM browser
        if (rawBrowserType) {
          const normalized = rawBrowserType.toLowerCase().trim()
          // Only map to chromium/firefox if explicitly specified
          // GPMLogin may return "chrome" for GPM browser profiles, so we need to be careful
          if (normalized === 'firefox' || normalized === 'ff' || normalized === 'moz' || normalized === 'firefox_browser') {
            browserType = 'firefox'
          } else if (normalized === 'chromium' && normalized !== 'chrome') {
            // Only map to chromium if explicitly "chromium", not "chrome"
            // "chrome" in GPMLogin usually means GPM browser
            browserType = 'chromium'
          } else if (normalized === 'gpm' || normalized === 'gpmbrowser' || normalized === 'gpm_browser') {
            browserType = 'gpm'
          } else {
            // Default to GPM browser for GPMLogin profiles
            // Most GPMLogin profiles are GPM browser, even if API returns "chrome"
            browserType = 'gpm'
          }
        }

        if (!existing) {
          // Create new profile
          await prisma.profile.create({
            data: {
              name: gpmProfile.name,
              profileUid: gpmProfile.id,
              status: 'idle',
              groupId: isNaN(groupIdNum as number) ? null : groupIdNum,
              proxyId: proxyId,
              browserType: browserType || 'gpm',
              browserProvider: browserProvider || 'gpmlogin',
              browserConnectionId:
                browserProvider === 'gpmlogin_global'
                  ? connectionId || 'global-gpm'
                  : connectionId || 'local-gpm',
            },
          })
          synced++
          if (proxyId) proxySynced++
        } else {
          // Update existing profile if name, group, proxy, or browserType changed
          // NOTE: We don't update autoResetIp from GPMLogin sync - it's a local setting
          const updateData: any = {}
          if (existing.name !== gpmProfile.name) {
            updateData.name = gpmProfile.name
          }
          if (existing.groupId !== groupIdNum && !isNaN(groupIdNum as number)) {
            updateData.groupId = groupIdNum
          }
          // Sync proxy: update if GPMLogin has proxy and local doesn't, or if proxy changed
          if (proxyId !== existing.proxyId) {
            updateData.proxyId = proxyId
            if (proxyId) proxySynced++
          }
          // Sync browserType: update if changed
          if (existing.browserType !== browserType) {
            updateData.browserType = browserType || 'gpm'
          }
          if (Object.keys(updateData).length > 0) {
            await prisma.profile.update({
              where: { id: existing.id },
              data: updateData,
            })

            // Ghi lại lịch sử thay đổi từ sync
            // Re-fetch existing to get proxy label if needed
            const oldProfileWithProxy = await prisma.profile.findUnique({
              where: { id: existing.id },
              include: { proxy: { select: { label: true } } }
            })
            const newProfileWithProxy = await prisma.profile.findUnique({
              where: { id: existing.id },
              include: { proxy: { select: { label: true } } }
            })

            if (oldProfileWithProxy && newProfileWithProxy) {
              await this.recordProfileChanges(oldProfileWithProxy, newProfileWithProxy, {
                ...updateData,
                syncSource: 'gpmlogin'
              } as any)
            }

            updated++
          }
        }
      }

      await this.logService.logInfo('core', `Profiles synced from GPMLogin`, {
        total: allProfiles.length,
        synced,
        updated,
        proxySynced,
      })

      return { synced, total: allProfiles.length }
    } catch (error) {
      await this.logService.logError('core', 'Error syncing profiles from GPMLogin', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * List all profiles
   */
  async listProfiles(filter?: {
    status?: string
    search?: string
    groupId?: string
    browserType?: string
    accountType?: string
    browserConnectionId?: string
  }): Promise<Profile[]> {
    const where: Prisma.ProfileWhereInput = {}

    // Build base filters (these are AND conditions)
    const baseConditions: Prisma.ProfileWhereInput = {}
    if (filter?.status) baseConditions.status = filter.status
    if (filter?.groupId) {
      const groupIdNum = parseInt(filter.groupId, 10)
      if (!isNaN(groupIdNum)) {
        baseConditions.groupId = groupIdNum
      }
    }
    if (filter?.browserType) {
      baseConditions.browserType = filter.browserType
    }
    if (filter?.browserConnectionId) {
      baseConditions.browserConnectionId = filter.browserConnectionId
    }
    if (filter?.accountType) {
      // Filter profiles that have at least one account with the specified accountType
      baseConditions.accounts = {
        some: {
          accountType: filter.accountType,
        },
      }
    }

    // Handle search (OR conditions that should be ANDed with base filters)
    if (filter?.search) {
      const searchTerm = filter.search.trim()
      if (searchTerm) {
        // First, find proxy IDs that match the search term
        const matchingProxies = await prisma.proxy.findMany({
          where: {
            OR: [
              { label: { contains: searchTerm } },
              { rawProxy: { contains: searchTerm } },
            ],
          },
          select: { id: true },
        })
        const matchingProxyIds = matchingProxies.map((p) => p.id)

        // Build OR conditions for search
        const searchConditions: Prisma.ProfileWhereInput[] = [
          { name: { contains: searchTerm } },
          { profileUid: { contains: searchTerm } },
        ]

        // Add proxy ID filter if we found matching proxies
        if (matchingProxyIds.length > 0) {
          searchConditions.push({ proxyId: { in: matchingProxyIds } })
        }

        // Combine base filters with search OR conditions using AND
        const andConditions: Prisma.ProfileWhereInput[] = []

        // Add base conditions if any exist
        if (Object.keys(baseConditions).length > 0) {
          andConditions.push(baseConditions)
        }

        // Add search OR conditions
        andConditions.push({ OR: searchConditions })

        // If we have both base and search conditions, use AND
        // Otherwise, just use the single condition
        if (andConditions.length > 1) {
          where.AND = andConditions
        } else if (andConditions.length === 1) {
          Object.assign(where, andConditions[0])
        } else {
          // This shouldn't happen, but just use search OR
          where.OR = searchConditions
        }
      } else {
        // Empty search, just use base conditions
        Object.assign(where, baseConditions)
      }
    } else {
      // No search, just use base conditions
      Object.assign(where, baseConditions)
    }

    return prisma.profile.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' }, // Mới tạo nhất lên đầu
        { updatedAt: 'desc' }, // Nếu cùng createdAt, thì mới cập nhật nhất lên đầu
      ],
      include: {
        proxy: true,
        connection: true,
        _count: {
          select: { accounts: true },
        },
      },
    })
  }

  /**
   * Get profile by ID (internal DB id) or profileUid (GPMLogin UID)
   * Falls back to profileUid lookup if not found by internal id.
   */
  async getProfile(id: string): Promise<Profile | null> {
    // Try internal CUID first
    const byId = await prisma.profile.findUnique({
      where: { id },
      include: {
        proxy: true,
        accounts: true,
        connection: true,
      },
    })
    if (byId) return byId

    // Fallback: try by profileUid (GPMLogin UID)
    return prisma.profile.findUnique({
      where: { profileUid: id },
      include: {
        proxy: true,
        accounts: true,
        connection: true,
      },
    })
  }

  /**
   * Check if profile is actually running by attempting to connect to debugging port
   * Returns true if profile is running, false otherwise
   */
  private async checkIfProfileRunning(profile: Profile): Promise<boolean> {
    // If no debugging port, assume not running
    if (!profile.remoteDebuggingPort) {
      return false
    }

    try {
      // Try to connect to the debugging port
      // Chrome DevTools Protocol endpoint
      const response = await fetch(`http://127.0.0.1:${profile.remoteDebuggingPort}/json/version`, {
        signal: AbortSignal.timeout(2000), // 2s timeout
      })

      if (response.ok) {
        return true // Port is responding, profile is running
      }
    } catch (error) {
      // Connection failed, profile is not running
      // This is expected if profile was closed externally
    }

    return false
  }

  /**
   * Verify if profile is actually running and update status if needed
   * Returns the actual status and whether it was updated
   */
  async verifyProfileStatus(profileId: string): Promise<{
    actualStatus: 'running' | 'idle'
    updated: boolean
  }> {
    const profile = await this.getProfile(profileId)
    if (!profile) {
      throw new Error('Profile not found')
    }

    // If status is already idle, no need to verify
    if (profile.status === 'idle') {
      return { actualStatus: 'idle', updated: false }
    }

    // Check if profile is actually running
    const isRunning = await this.checkIfProfileRunning(profile)

    if (!isRunning && profile.status !== 'idle') {
      // Profile is not running but status says it is - update to idle
      await prisma.profile.update({
        where: { id: profileId },
        data: {
          status: 'idle',
          remoteDebuggingPort: null,
          processId: null,
        },
      })

      await this.logService.logInfo('core', `Profile status synced: ${profile.name} was marked running but is actually idle`, {
        profileId,
        previousStatus: profile.status,
      })

      return { actualStatus: 'idle', updated: true }
    }

    return {
      actualStatus: isRunning ? 'running' : 'idle',
      updated: false,
    }
  }

  /**
   * Start profile (open in GPMLogin)
   * Uses spec-compliant GpmLoginAdapter.startProfile() method
   * If autoResetIp is enabled and profile has proxy, resets proxy IP before starting
   */
  async startProfile(id: string, accountId?: string): Promise<Profile> {
    const profile = await this.getProfile(id)
    if (!profile) {
      throw new Error('Profile not found')
    }

    // Log profile info for debugging
    await this.logService.logInfo('core', `Starting profile: ${profile.name}`, {
      profileId: id,
      autoResetIp: profile.autoResetIp,
      proxyId: profile.proxyId,
      hasProxy: !!(profile as any).proxy,
      proxyLabel: (profile as any).proxy?.label || 'N/A',
      browserProvider: profile.browserProvider || 'NOT SET',
      browserType: profile.browserType || 'NOT SET',
      profilePath: profile.profilePath || 'NOT SET',
      profileUid: profile.profileUid || 'NOT SET',
    })

    try {
      // If autoResetIp is enabled and profile has proxy, reset IP first
      const profileWithProxy = profile as any
      if (profile.autoResetIp && profile.proxyId && profileWithProxy.proxy) {
        // Update status to changing_proxy
        await prisma.profile.update({
          where: { id },
          data: { status: 'changing_proxy' },
        })

        try {
          const { ProxyService } = await import('./ProxyService')
          const proxyService = new ProxyService()

          await this.logService.logInfo('core', `Starting proxy IP reset before opening profile: ${profile.name}`, {
            profileId: id,
            proxyId: (profile as any).proxyId,
            proxyLabel: (profile as any).proxy.label,
          })

          const resetResult = await proxyService.resetProxyIp(profile.proxyId)

          await this.logService.logInfo('core', `Proxy IP reset completed before starting profile: ${profile.name}`, {
            profileId: id,
            proxyId: profile.proxyId,
            newIp: resetResult.publicIp,
            status: resetResult.status,
          })

          // Wait additional 2-3 seconds to ensure IP change is fully propagated
          // This ensures GPMLogin will use the new IP when starting the profile
          const additionalWaitTime = 2000 + Math.random() * 1000 // 2-3 seconds
          await new Promise((resolve) => setTimeout(resolve, additionalWaitTime))

          await this.logService.logInfo('core', `Waited ${Math.round(additionalWaitTime / 1000)}s after IP reset, starting profile: ${profile.name}`, {
            profileId: id,
          })
        } catch (error) {
          // Log warning but continue with profile start
          await this.logService.logError('core', `Failed to reset proxy IP before starting profile: ${profile.name}`, {
            profileId: id,
            proxyId: profile.proxyId,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      } else {
        // Log why auto reset IP was skipped
        await this.logService.logInfo('core', `Skipping auto reset IP for profile: ${profile.name}`, {
          profileId: id,
          reason: !profile.autoResetIp ? 'autoResetIp is false' : !profile.proxyId ? 'no proxyId' : !(profile as any).proxy ? 'proxy not loaded' : 'unknown',
          autoResetIp: profile.autoResetIp,
          proxyId: profile.proxyId,
          hasProxy: !!(profile as any).proxy,
        })
      }

      // Update status to opening_browser before calling adapter
      await prisma.profile.update({
        where: { id },
        data: { status: 'opening_browser' },
      })

      // Start profile based on browser provider
      let remoteDebuggingPort: number | undefined
      let processId: number | undefined
      const browserProvider = profile.browserProvider || 'gpmlogin'

      await this.logService.logInfo('core', `Determining browser provider for profile: ${profile.name}`, {
        profileId: id,
        browserProviderFromDB: profile.browserProvider,
        browserProviderUsed: browserProvider,
        profilePath: profile.profilePath,
        profileUid: profile.profileUid,
      })

      if (browserProvider === 'gpmlogin' || browserProvider === 'gpmlogin_global') {
        if (!profile.browserConnectionId) {
          const defaultConnectionId =
            browserProvider === 'gpmlogin_global' ? 'global-gpm' : 'local-gpm'
          await prisma.profile.update({
            where: { id },
            data: { browserConnectionId: defaultConnectionId },
          })
          profile.browserConnectionId = defaultConnectionId
        }

        const adapter = await this.getGpmAdapterForProfile(id)
        await this.logService.logInfo('core', `GPM API endpoint for start: ${adapter.getBaseUrl()}`, {
          profileId: id,
          apiUrl: adapter.getApiUrl(),
          apiVersion: adapter.getApiVersion(),
          browserProvider,
          browserConnectionId: profile.browserConnectionId,
        })

        const ping = await adapter.testConnection()
        if (!ping.ok) {
          throw new Error(ping.message)
        }

        const result = await adapter.startProfile(profile.profileUid)

        if (!result.success) {
          throw new Error(result.message || 'Failed to start profile')
        }

        remoteDebuggingPort = result.remoteDebuggingPort || undefined
      } else if (browserProvider === 'chrome') {
        if (!profile.profilePath) {
          throw new Error('Chrome profile path is required')
        }

        // Get proxy string if available
        let proxyString: string | undefined = undefined
        const profileWithProxy = profile as any
        if (profileWithProxy.proxy) {
          proxyString = profileWithProxy.proxy.rawProxy
        }

        // Generate a random port for remote debugging (9222-9299)
        const port = 9222 + Math.floor(Math.random() * 78)

        try {
          const startResult = await this.chromeAdapter.startProfile(profile.profilePath, {
            executablePath: profile.executablePath || undefined,
            proxy: proxyString,
            remoteDebuggingPort: port,
          })

          remoteDebuggingPort = startResult.port
          processId = startResult.pid

          // Verify Chrome actually started
          if (!processId || processId === 0) {
            throw new Error('Chrome process PID is invalid. Chrome may not have started successfully.')
          }

          if (!remoteDebuggingPort) {
            throw new Error('Chrome remote debugging port is not available. Chrome may not have started successfully.')
          }

          await this.logService.logInfo('core', `Chrome profile started successfully`, {
            profileId: id,
            profileName: profile.name,
            processId,
            remoteDebuggingPort,
            profilePath: profile.profilePath,
          })
        } catch (error) {
          await this.logService.logError('core', `Failed to start Chrome profile: ${profile.name}`, {
            profileId: id,
            profilePath: profile.profilePath,
            error: error instanceof Error ? error.message : String(error),
          })
          throw error
        }
      } else if (browserProvider === 'firefox') {
        if (!profile.profilePath) {
          throw new Error('Firefox profile path is required')
        }

        // Get proxy string if available (already set in prefs.js during creation)
        let proxyString: string | undefined = undefined
        const profileWithProxy = profile as any
        if (profileWithProxy.proxy) {
          proxyString = profileWithProxy.proxy.rawProxy
          // Update proxy in prefs.js if changed
          // Note: For simplicity, we assume proxy is already set
        }

        // Generate a random port for remote debugging (6000-6099 for Firefox)
        const port = 6000 + Math.floor(Math.random() * 100)

        const startResult = await this.firefoxAdapter.startProfile(profile.profilePath, {
          executablePath: profile.executablePath || undefined,
          proxy: proxyString,
          remoteDebuggingPort: port,
        })

        remoteDebuggingPort = startResult.port
        processId = startResult.pid
      } else {
        throw new Error(`Unsupported browser provider: ${browserProvider}`)
      }

      // Update status to 'starting' first, then 'running' if we have port
      // If no port, profile might be starting or already running
      const status = remoteDebuggingPort ? 'running' : 'starting'

      const oldStatus = profile.status
      const updated = await prisma.profile.update({
        where: { id },
        data: {
          status,
          remoteDebuggingPort,
          ...(processId !== undefined && { processId }),
          lastOpened: new Date(),
        },
      })

      // NOTE: Status changes are no longer recorded in history (removed per user request)

      await this.logService.logInfo('core', `Profile started: ${profile.name}`, {
        profileId: id,
        port: remoteDebuggingPort,
      })

      // Install extensions if profile has any and we have remote debugging port
      if (remoteDebuggingPort) {
        // Run extension installation asynchronously (don't block profile start)
        this.installProfileExtensions(id, remoteDebuggingPort).catch((error) => {
          // Log error but don't fail profile start
          this.logService.logError('core', `Failed to install extensions for profile: ${profile.name}`, {
            profileId: id,
            error: error instanceof Error ? error.message : String(error),
          })
        })

        // Phóng trang web mục tiêu (Auto Start URL - Phase 5)
        this.openAccountStartupUrl(id, remoteDebuggingPort, accountId).catch((error) => {
          this.logService.logError('core', `Failed to auto open startup URL: ${error.message}`, { profileId: id })
        })
      }

      return updated
    } catch (error) {
      await prisma.profile.update({
        where: { id },
        data: { status: 'error' },
      })

      await this.logService.logError('core', `Error starting profile: ${profile.name}`, {
        profileId: id,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   * Stop profile (close in GPMLogin)
   * Uses spec-compliant GpmLoginAdapter.stopProfile() method
   */
  async stopProfile(id: string): Promise<Profile> {
    const profile = await this.getProfile(id)
    if (!profile) {
      throw new Error('Profile not found')
    }

    // If profile is already idle, return it
    if (profile.status === 'idle') {
      return profile
    }

    // Verify if profile is actually running before attempting to stop
    const isRunning = await this.checkIfProfileRunning(profile)
    if (!isRunning) {
      // Profile is already closed, just update status
      const updated = await prisma.profile.update({
        where: { id },
        data: {
          status: 'idle',
          remoteDebuggingPort: null,
          processId: null,
          lastClosed: new Date(),
        },
      })

      await this.logService.logInfo('core', `Profile was already closed externally, updated status: ${profile.name}`, {
        profileId: id,
      })

      return updated
    }

    try {
      // Update status to stopping
      await prisma.profile.update({
        where: { id },
        data: { status: 'stopping' },
      })

      const browserProvider = profile.browserProvider || 'gpmlogin'
      let stopSuccess = false

      // Stop profile based on browser provider
      if (browserProvider === 'gpmlogin' || browserProvider === 'gpmlogin_global') {
        // Try to stop profile via GPMLogin API
        const adapter = await this.getGpmAdapterForProfile(id)
        const result = await adapter.stopProfile(profile.profileUid)
        stopSuccess = result.success
      } else if (browserProvider === 'chrome' || browserProvider === 'firefox') {
        // Stop Chrome/Firefox by process ID
        if (profile.processId && profile.processId > 0) {
          if (browserProvider === 'chrome') {
            // Pass profilePath as fallback in case PID kill fails
            stopSuccess = await this.chromeAdapter.stopProfile(profile.processId, profile.profilePath || undefined)
          } else {
            // For Firefox, always kill all Firefox processes to ensure clean shutdown
            stopSuccess = await this.firefoxAdapter.stopProfile(profile.processId)
          }
        } else {
          // If no PID, try to kill by remoteDebuggingPort or profilePath (fallback)
          if (browserProvider === 'chrome') {
            // For Chrome, try to kill by remoteDebuggingPort first, then profilePath
            await this.logService.logWarning('core', `No processId for Chrome profile, using fallback methods`, {
              profileId: id,
              profileUid: profile.profileUid,
              profilePath: profile.profilePath,
              remoteDebuggingPort: profile.remoteDebuggingPort,
            })
            stopSuccess = await this.chromeAdapter.stopProfile(
              0, // PID = 0 means use fallback
              profile.profilePath || undefined,
              profile.remoteDebuggingPort || undefined
            )
          } else if (browserProvider === 'firefox') {
            // For Firefox, kill all Firefox processes if PID not available
            await this.logService.logWarning('core', `No processId for Firefox profile, killing all Firefox processes`, {
              profileId: id,
              profileUid: profile.profileUid,
            })
            stopSuccess = await this.firefoxAdapter.stopProfile(0) // 0 means kill all
          } else {
            await this.logService.logWarning('core', `Cannot stop ${browserProvider} profile: processId not found`, {
              profileId: id,
              profileUid: profile.profileUid,
            })
            stopSuccess = false
          }
        }
      } else {
        throw new Error(`Unsupported browser provider: ${browserProvider}`)
      }

      // Even if API call fails, update database status to idle
      // This handles cases where profile was already closed externally
      const oldStatus = profile.status

      // Update status regardless of API result
      // If API failed but profile is actually closed, sync will fix it later
      const updated = await prisma.profile.update({
        where: { id },
        data: {
          status: 'idle',
          remoteDebuggingPort: null,
          processId: null, // Clear process ID
          lastClosed: new Date(),
        },
      })

      // Log result
      if (!stopSuccess) {
        await this.logService.logWarning('core', `${browserProvider} profile stop reported failure, but updated status to idle: ${profile.name}`, {
          profileId: id,
          profileUid: profile.profileUid,
          browserProvider,
        })
      } else {
        await this.logService.logInfo('core', `Profile stopped: ${profile.name}`, {
          profileId: id,
          browserProvider,
        })
      }

      // NOTE: Status changes are no longer recorded in history (removed per user request)

      return updated
    } catch (error) {
      // If there's an error, try to update status anyway
      // This handles network errors or other issues
      try {
        const updated = await prisma.profile.update({
          where: { id },
          data: {
            status: 'idle',
            remoteDebuggingPort: null,
            processId: null,
            lastClosed: new Date(),
          },
        })

        await this.logService.logWarning('core', `Error stopping profile via API, but updated status to idle: ${profile.name}`, {
          profileId: id,
          error: error instanceof Error ? error.message : String(error),
        })

        return updated
      } catch (updateError) {
        // If we can't even update the database, log and throw original error
        await this.logService.logError('core', `Error stopping profile and updating status: ${profile.name}`, {
          profileId: id,
          stopError: error instanceof Error ? error.message : String(error),
          updateError: updateError instanceof Error ? updateError.message : String(updateError),
        })

        throw error
      }
    }
  }

  /**
   * Create new profile in browser provider (GPMLogin/Chrome/Firefox) and database
   */
  async createProfile(data: {
    name: string
    proxyId?: string | null
    autoResetIp?: boolean
    groupId?: string | null
    browserType?: string
    browserProvider?: string // 'gpmlogin' | 'chrome' | 'firefox'
    browserConnectionId?: string | null
    executablePath?: string | null
  }): Promise<Profile> {
    try {
      const browserProvider = data.browserProvider || 'gpmlogin'

      // Get proxy string if proxyId is provided
      let proxyString: string | undefined = undefined
      if (data.proxyId) {
        const proxy = await prisma.proxy.findUnique({
          where: { id: data.proxyId },
        })
        if (proxy) {
          proxyString = proxy.rawProxy
        }
      }

      let profileUid: string
      let profilePath: string | null = null
      let groupIdNumber: number | null = null
      let executablePath: string | null = data.executablePath || null

      // Create profile based on browser provider
      if (browserProvider === 'gpmlogin' || browserProvider === 'gpmlogin_global') {
        // Convert groupId to number if provided (GPMLogin API expects number)
        if (data.groupId) {
          const parsed = parseInt(data.groupId, 10)
          if (!isNaN(parsed)) {
            groupIdNumber = parsed
          }
        }

        // Create profile in GPMLogin
        // Map browserType to browser_core for GPMLogin API
        // GPMLogin API accepts: 'chromium' or 'firefox', not 'gpm'
        let browserCore = 'chromium' // Default to chromium
        if (data.browserType === 'firefox') {
          browserCore = 'firefox'
        } else if (data.browserType === 'chromium' || data.browserType === 'gpm') {
          browserCore = 'chromium'
        }

        let gpmProfile
        try {
          const adapter = data.browserProvider
            ? await this.getGpmAdapterForProvider(data.browserProvider)
            : data.browserConnectionId
              ? await this.getGpmAdapterForConnection(data.browserConnectionId)
              : await this.getGpmAdapterForProvider('gpmlogin')

          gpmProfile = await adapter.createProfile({
            name: data.name,
            proxy: proxyString,
            group_id: groupIdNumber ?? undefined,
            browser_core: browserCore,
          })
        } catch (error) {
          await this.logService.logError('core', `Failed to create profile in GPMLogin: ${data.name}`, {
            error: error instanceof Error ? error.message : String(error),
            name: data.name,
            proxyId: data.proxyId,
            groupId: groupIdNumber,
            browserType: data.browserType || 'gpm',
          })
          throw error
        }

        if (!gpmProfile || !gpmProfile.id) {
          await this.logService.logError('core', `GPMLogin createProfile returned invalid data: ${data.name}`, {
            gpmProfile: gpmProfile ? JSON.stringify(gpmProfile) : 'null',
            name: data.name,
          })
          throw new Error('Failed to create profile in GPMLogin: Invalid response data')
        }

        profileUid = gpmProfile.id
      } else if (browserProvider === 'chrome') {
        // Create Chrome profile
        try {
          await this.logService.logInfo('core', `Creating Chrome profile: ${data.name}`, {
            profileName: data.name,
            hasProxy: !!proxyString,
          })

          const chromeProfileInfo = await this.chromeAdapter.createProfile(data.name, {
            proxy: proxyString,
          })

          // Use full path as profileUid for uniqueness (or generate a unique ID)
          profileUid = `chrome_${Date.now()}_${Math.random().toString(36).substring(7)}`
          profilePath = chromeProfileInfo.profilePath
          executablePath = executablePath || chromeProfileInfo.executablePath || null

          await this.logService.logInfo('core', `Chrome profile created successfully: ${data.name}`, {
            profileName: data.name,
            profilePath,
            executablePath,
            profileUid,
          })
        } catch (error) {
          await this.logService.logError('core', `Failed to create Chrome profile: ${data.name}`, {
            profileName: data.name,
            error: error instanceof Error ? error.message : String(error),
          })
          throw error
        }
      } else if (browserProvider === 'firefox') {
        // Create Firefox profile
        const firefoxProfileInfo = await this.firefoxAdapter.createProfile(data.name, {
          proxy: proxyString,
        })
        // Use full path as profileUid for uniqueness (or generate a unique ID)
        profileUid = `firefox_${Date.now()}_${Math.random().toString(36).substring(7)}`
        profilePath = firefoxProfileInfo.profilePath
        executablePath = executablePath || firefoxProfileInfo.executablePath || null
      } else {
        throw new Error(`Unsupported browser provider: ${browserProvider}`)
      }

      // Create profile in database
      const profile = await prisma.profile.create({
        data: {
          name: data.name,
          profileUid,
          proxyId: data.proxyId || null,
          autoResetIp: data.autoResetIp || false,
          groupId: groupIdNumber,
          browserType: data.browserType || (browserProvider === 'firefox' ? 'firefox' : 'chromium'),
          browserProvider,
          browserConnectionId:
            browserProvider === 'gpmlogin_global'
              ? data.browserConnectionId || 'global-gpm'
              : browserProvider === 'gpmlogin'
                ? data.browserConnectionId || 'local-gpm'
                : null,
          profilePath,
          executablePath,
          status: 'idle',
        },
        include: {
          proxy: true,
        },
      })

      await this.logService.logInfo('core', `Profile created: ${data.name}`, {
        profileId: profile.id,
        profileUid,
        browserProvider,
        proxyId: data.proxyId,
        groupId: groupIdNumber,
      })

      return profile
    } catch (error) {
      await this.logService.logError('core', 'Error creating profile', {
        error: error instanceof Error ? error.message : String(error),
        name: data.name,
        browserProvider: data.browserProvider || 'gpmlogin',
      })
      throw error
    }
  }

  /**
   * Update profile (name, proxy, groupId, autoResetIp)
   */
  async updateProfile(
    profileId: string,
    data: {
      name?: string
      proxyId?: string | null
      groupId?: string | null
      autoResetIp?: boolean
      browserType?: string
      browserProvider?: string
      browserConnectionId?: string | null
      executablePath?: string | null
    }
  ): Promise<Profile> {
    const profile = await this.getProfile(profileId)
    if (!profile) {
      throw new Error('Profile not found')
    }

    // Lấy profile hiện tại với proxy để so sánh
    const oldProfile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        proxy: { select: { label: true } },
      },
    })

    if (!oldProfile) {
      throw new Error('Profile not found')
    }

    try {
      const browserProvider = profile.browserProvider || 'gpmlogin'

      // Prepare update data for database and GPMLogin
      const updateData: any = {}
      const gpmUpdateData: any = {}

      // Only get GPMLogin profile info if it's a GPMLogin profile
      if (browserProvider === 'gpmlogin' || browserProvider === 'gpmlogin_global') {
        const gpmProfileInfo = await (await this.getGpmAdapterForProfile(profileId)).getProfileInfo(
          profile.profileUid
        )
        if (!gpmProfileInfo || !gpmProfileInfo.name) {
          throw new Error('Failed to get profile info from GPMLogin')
        }
        gpmUpdateData.profile_name = gpmProfileInfo.name // Always include profile_name (required)
      }

      // Update name if provided
      if (data.name !== undefined && data.name !== profile.name) {
        updateData.name = data.name
        gpmUpdateData.profile_name = data.name
      }

      // Update groupId if provided
      if (data.groupId !== undefined) {
        let groupIdNum: number | null = null
        if (data.groupId) {
          const parsed = parseInt(data.groupId, 10)
          if (!isNaN(parsed)) {
            groupIdNum = parsed
          }
        }

        // Check if group changed
        if (groupIdNum !== profile.groupId) {
          updateData.groupId = groupIdNum
          gpmUpdateData.group_id = groupIdNum || undefined
        }
      }

      // Update proxy if provided
      if (data.proxyId !== undefined) {
        let proxyString: string | null = null
        if (data.proxyId) {
          const proxy = await prisma.proxy.findUnique({
            where: { id: data.proxyId },
          })
          if (proxy) {
            proxyString = proxy.rawProxy
          }
        }

        // We pass the raw proxy string to the adapter. 
        // The adapter will format it according to the GPM version (Local vs Global).
        // Pass the profile name as fallback to ensure mandatory'profile_name' is sent.
        gpmUpdateData.profile_name = profile.name
        gpmUpdateData.proxy = proxyString || '' 
        updateData.proxyId = data.proxyId
      }

      // Update autoResetIp if provided (only in database, not in GPMLogin)
      if (data.autoResetIp !== undefined) {
        updateData.autoResetIp = data.autoResetIp
      }

      // Update browserType if provided (send to GPMLogin as browser_core and save to DB)
      if (data.browserType !== undefined) {
        // Only update GPMLogin if it's a GPMLogin profile
        if (profile.browserProvider === 'gpmlogin' || profile.browserProvider === 'gpmlogin_global') {
          gpmUpdateData.browser_core = data.browserType
        }
        updateData.browserType = data.browserType
      }

      // Update browserProvider if provided (only in database, not in GPMLogin)
      if (data.browserProvider !== undefined) {
        updateData.browserProvider = data.browserProvider
        if (data.browserConnectionId === undefined) {
          if (data.browserProvider === 'gpmlogin_global') {
            updateData.browserConnectionId = 'global-gpm'
          } else if (data.browserProvider === 'gpmlogin') {
            updateData.browserConnectionId = 'local-gpm'
          } else if (data.browserProvider === 'chrome' || data.browserProvider === 'firefox') {
            updateData.browserConnectionId = null
          }
        }
      }

      // Update browserConnectionId if provided
      if (data.browserConnectionId !== undefined) {
        updateData.browserConnectionId = data.browserConnectionId || null
        if (
          data.browserConnectionId === '' &&
          (updateData.browserProvider === 'gpmlogin' ||
            profile.browserProvider === 'gpmlogin')
        ) {
          updateData.browserConnectionId = 'local-gpm'
        }
      }

      // Update executablePath if provided (only in database)
      if (data.executablePath !== undefined) {
        updateData.executablePath = data.executablePath
      }

      // Update in GPMLogin only if it's a GPMLogin profile
      if ((profile.browserProvider === 'gpmlogin' || profile.browserProvider === 'gpmlogin_global') && Object.keys(gpmUpdateData).length > 1) {
        // Only update if there are changes (more than just profile_name)
        const adapter = await this.getGpmAdapterForProfile(profileId)
        const success = await adapter.updateProfile(profile.profileUid, gpmUpdateData)
        if (!success) {
          throw new Error('Failed to update profile in GPMLogin')
        }
      }
      // For Chrome/Firefox profiles, no need to update external system

      // Update in database
      const updated = await prisma.profile.update({
        where: { id: profileId },
        data: updateData,
        include: {
          proxy: true,
        },
      })

      // Ghi lại lịch sử thay đổi
      await this.recordProfileChanges(oldProfile, updated, data)

      await this.logService.logInfo('core', `Profile updated: ${profile.name}`, {
        profileId,
        updates: updateData,
        gpmUpdates: gpmUpdateData,
      })

      return updated
    } catch (error) {
      await this.logService.logError('core', `Error updating profile: ${profile.name}`, {
        profileId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Ghi lại các thay đổi của profile
   */
  private async recordProfileChanges(
    oldProfile: Profile & { proxy: { label: string } | null },
    newProfile: Profile & { proxy: { label: string } | null },
    data: {
      name?: string
      proxyId?: string | null
      groupId?: string | null
      autoResetIp?: boolean
      browserType?: string
      browserProvider?: string
      browserConnectionId?: string | null
      executablePath?: string | null
      syncSource?: string
    }
  ): Promise<void> {
    // Name change
    if (data.name !== undefined && data.name !== oldProfile.name) {
      await this.changeHistoryService.recordProfileChange({
        profileId: oldProfile.id,
        changeType: 'name',
        fieldName: 'name',
        oldValue: oldProfile.name,
        newValue: data.name,
        description: `Name changed from "${oldProfile.name}" to "${data.name}"`,
        changedBy: data.syncSource || 'system'
      })
    }

    // Proxy change
    if (data.proxyId !== undefined && data.proxyId !== oldProfile.proxyId) {
      const oldProxyLabel = oldProfile.proxy?.label || 'None'
      const newProxyLabel = newProfile.proxy?.label || 'None'
      await this.changeHistoryService.recordProfileChange({
        profileId: oldProfile.id,
        changeType: 'proxy',
        fieldName: 'proxyId',
        oldValue: oldProfile.proxyId || null,
        newValue: data.proxyId || null,
        description: `Proxy changed from "${oldProxyLabel}" to "${newProxyLabel}"`,
        changedBy: data.syncSource || 'system'
      })
    }

    // Group change
    if (data.groupId !== undefined) {
      const oldGroupId = oldProfile.groupId?.toString() || null
      const newGroupId = data.groupId || null
      if (oldGroupId !== newGroupId) {
        await this.changeHistoryService.recordProfileChange({
          profileId: oldProfile.id,
          changeType: 'group',
          fieldName: 'groupId',
          oldValue: oldGroupId,
          newValue: newGroupId,
          description: `Group changed from "${oldGroupId || 'None'}" to "${newGroupId || 'None'}"`,
          changedBy: data.syncSource || 'system'
        })
      }
    }

    // Auto reset IP change
    if (data.autoResetIp !== undefined && data.autoResetIp !== oldProfile.autoResetIp) {
      await this.changeHistoryService.recordProfileChange({
        profileId: oldProfile.id,
        changeType: 'auto_reset_ip',
        fieldName: 'autoResetIp',
        oldValue: oldProfile.autoResetIp.toString(),
        newValue: data.autoResetIp.toString(),
        description: `Auto reset IP changed from ${oldProfile.autoResetIp} to ${data.autoResetIp}`,
        changedBy: data.syncSource || 'system'
      })
    }

    // Browser type change
    if (data.browserType !== undefined && data.browserType !== oldProfile.browserType) {
      await this.changeHistoryService.recordProfileChange({
        profileId: oldProfile.id,
        changeType: 'other',
        fieldName: 'browserType',
        oldValue: oldProfile.browserType || 'None',
        newValue: data.browserType,
        description: `Browser type changed from "${oldProfile.browserType || 'None'}" to "${data.browserType}"`,
        changedBy: data.syncSource || 'system'
      })
    }

    // Browser provider change
    if (data.browserProvider !== undefined && data.browserProvider !== oldProfile.browserProvider) {
      await this.changeHistoryService.recordProfileChange({
        profileId: oldProfile.id,
        changeType: 'other',
        fieldName: 'browserProvider',
        oldValue: oldProfile.browserProvider || 'None',
        newValue: data.browserProvider,
        description: `Browser provider changed from "${oldProfile.browserProvider || 'None'}" to "${data.browserProvider}"`,
        changedBy: data.syncSource || 'system'
      })
    }

    // Connection change
    if (data.browserConnectionId !== undefined && data.browserConnectionId !== oldProfile.browserConnectionId) {
      await this.changeHistoryService.recordProfileChange({
        profileId: oldProfile.id,
        changeType: 'other',
        fieldName: 'browserConnectionId',
        oldValue: oldProfile.browserConnectionId,
        newValue: data.browserConnectionId,
        description: `Browser connection changed from "${oldProfile.browserConnectionId}" to "${data.browserConnectionId}"`,
        changedBy: data.syncSource || 'system'
      })
    }

    // Executable path change
    if (data.executablePath !== undefined && data.executablePath !== oldProfile.executablePath) {
      await this.changeHistoryService.recordProfileChange({
        profileId: oldProfile.id,
        changeType: 'other',
        fieldName: 'executablePath',
        oldValue: oldProfile.executablePath || 'Default',
        newValue: data.executablePath || 'Default',
        description: `Executable path changed from "${oldProfile.executablePath || 'Default'}" to "${data.executablePath || 'Default'}"`,
        changedBy: data.syncSource || 'system'
      })
    }
  }

  /**
   * Change profile proxy (legacy method, use updateProfile instead)
   */
  async changeProfileProxy(profileId: string, proxyId: string | null): Promise<void> {
    await this.updateProfile(profileId, { proxyId })
  }

  /**
   * Get remote debugging info for BrowserController
   */
  async getRemoteDebugInfo(profileId: string): Promise<{ host: string; port: number } | null> {
    const profile = await this.getProfile(profileId)
    if (!profile || !profile.remoteDebuggingPort) {
      return null
    }

    return {
      host: '127.0.0.1', // GPMLogin runs locally
      port: profile.remoteDebuggingPort,
    }
  }

  /**
   * Install extensions for a profile after it's started
   * This runs asynchronously and should not block profile start/stop operations
   */
  private async installProfileExtensions(profileId: string, remoteDebuggingPort: number): Promise<void> {
    let session: any = null
    let page: any = null

    try {
      // Wait a bit for profile to fully start before attempting extension installation
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Check if profile is still running before proceeding
      const profile = await this.getProfile(profileId)
      if (!profile || profile.status !== 'running') {
        await this.logService.logInfo('core', `Profile not running, skipping extension installation`, {
          profileId,
          status: profile?.status,
        })
        return
      }

      // Get extension service from core (don't create new instance)
      const { core } = await import('../bootstrap')
      core.init()
      const extensionService = core.services.extensionService

      const profileExtensions = await extensionService.getProfileExtensions(profileId)
      const extensionsToInstall = profileExtensions.filter((pe) => !pe.installed)

      if (extensionsToInstall.length === 0) {
        return
      }

      await this.logService.logInfo('core', `Installing ${extensionsToInstall.length} extension(s) for profile`, {
        profileId,
        extensionCount: extensionsToInstall.length,
      })

      // Connect to browser via remote debugging with timeout
      const { PlaywrightBrowserController } = await import('@/integrations/BrowserController')
      const browserController = new PlaywrightBrowserController()

      // Use Promise.race to add overall timeout
      const connectPromise = browserController.connectByRemoteDebugging('127.0.0.1', remoteDebuggingPort)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 15000)
      )

      session = await Promise.race([connectPromise, timeoutPromise]) as any

      const browser = (session as any).getBrowser()
      const context = (session as any).getContext()

      if (!context) {
        await this.logService.logError('core', `Browser context not available for extension installation`, {
          profileId,
        })
        return
      }

      // Get existing pages - use a new tab for extension installation to avoid affecting main profile
      const pages = context.pages()
      // Create a new page/tab for extension installation instead of using main page
      // This prevents closing the main profile page
      page = await context.newPage()

      // Install each extension with individual timeout
      for (const pe of extensionsToInstall) {
        try {
          // Check if profile is still running before each extension
          const currentProfile = await this.getProfile(profileId)
          if (!currentProfile || currentProfile.status !== 'running') {
            await this.logService.logInfo('core', `Profile stopped, cancelling extension installation`, {
              profileId,
              extensionId: pe.extensionId,
            })
            break
          }

          // Install extension with timeout
          const installPromise = extensionService.installExtensionInBrowser(
            page,
            pe.extension.extensionId,
            pe.extension.storeUrl
          )
          const installTimeout = new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Installation timeout')), 60000)
          )

          const installed = await Promise.race([installPromise, installTimeout]) as boolean

          if (installed) {
            await extensionService.markExtensionInstalled(profileId, pe.extensionId)
            await this.logService.logInfo('core', `Extension installed: ${pe.extension.name}`, {
              profileId,
              extensionId: pe.extensionId,
            })
          }
        } catch (error) {
          await this.logService.logError('core', `Failed to install extension: ${pe.extension.name}`, {
            profileId,
            extensionId: pe.extensionId,
            error: error instanceof Error ? error.message : String(error),
          })
          // Continue with next extension
        }
      }

      // After installation, sync profile status to ensure it's accurate
      try {
        const finalProfile = await this.getProfile(profileId)
        if (finalProfile && finalProfile.status === 'running') {
          // Check if profile is actually still running by trying to get remote debugging info
          // If we can't connect, profile might have closed
          try {
            const debugInfo = await this.getRemoteDebugInfo(profileId)
            if (!debugInfo || !debugInfo.port) {
              // Profile might have closed, update status
              await prisma.profile.update({
                where: { id: profileId },
                data: {
                  status: 'idle',
                  remoteDebuggingPort: null,
                  lastClosed: new Date(),
                },
              })
              await this.logService.logInfo('core', `Profile status synced to idle after extension installation`, {
                profileId,
              })
            }
          } catch (syncError) {
            // If we can't check, don't update status - might be temporary issue
            console.error('Error syncing profile status:', syncError)
          }
        }
      } catch (syncError) {
        // Don't fail if sync check fails
        console.error('Error checking profile status after extension installation:', syncError)
      }
    } catch (error) {
      await this.logService.logError('core', `Error installing profile extensions`, {
        profileId,
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't throw - extension installation failure shouldn't block profile start
    } finally {
      // Clean up resources - close the extension installation page we created
      // But don't close the session or main pages
      try {
        if (page && !page.isClosed()) {
          // Navigate back to a safe page before closing, or just close the tab
          await page.close().catch(() => { })
        }
        // Don't close session - it's shared with the profile
        // The session will be closed when profile stops
      } catch (cleanupError) {
        // Ignore cleanup errors
        console.error('Error cleaning up extension installation page:', cleanupError)
      }
    }
  }

  /**
   * Ensure profile exists for account (from AUTOMATION_LAYER_SPEC.md)
   * If account has no profileId, tries to find or create one
   * Supports sharing profile from parent account via authViaAccountId
   */
  async ensureProfileForAccount(account: {
    id: string
    gpmloginProfileId?: string | null
    authViaAccountId?: string | null
  }): Promise<Profile> {
    // 1. If account already has a profile, return it
    if (account.gpmloginProfileId) {
      const profile = await this.getProfile(account.gpmloginProfileId)
      if (profile) {
        return profile
      }
    }

    // 2. If account has no profile but has authViaAccountId, try to reuse parent's profile
    if (!account.gpmloginProfileId && account.authViaAccountId) {
      const parent = await prisma.account.findUnique({
        where: { id: account.authViaAccountId },
        select: { id: true, gpmloginProfileId: true },
      })

      if (parent?.gpmloginProfileId) {
        const parentProfile = await this.getProfile(parent.gpmloginProfileId)
        if (parentProfile) {
          // Update child account to remember this profile
          await prisma.account.update({
            where: { id: account.id },
            data: { gpmloginProfileId: parent.gpmloginProfileId },
          })

          await this.logService.logInfo('core', `Reused parent profile for child account`, {
            accountId: account.id,
            parentAccountId: parent.id,
            profileId: parentProfile.id,
          })

          return parentProfile
        }
      }
    }

    // 3. Fallback to existing behavior: try to find an available profile
    const availableProfile = await prisma.profile.findFirst({
      where: {
        status: 'idle',
        accounts: {
          none: {},
        },
      },
    })

    if (availableProfile) {
      // Assign this profile to the account
      await prisma.account.update({
        where: { id: account.id },
        data: { gpmloginProfileId: availableProfile.id },
      })

      await this.logService.logInfo('core', `Assigned profile to account`, {
        accountId: account.id,
        profileId: availableProfile.id,
      })

      return availableProfile
    }

    // If no available profile, throw error (could also create new profile via GPMLogin)
    throw new Error(`No available profile found for account ${account.id}. Please assign a profile or sync from GPMLogin.`)
  }

  /**
   * Ensure profile is running and return remote debugging info (from AUTOMATION_LAYER_SPEC.md)
   * Returns { host, port } for BrowserController to connect
   */
  async ensureProfileRunning(profileId: string): Promise<{ host: string; port: number }> {
    const profile = await this.getProfile(profileId)
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`)
    }

    // Always start profile fresh to ensure we have a valid port
    // Even if profile is marked as 'running', the port might be stale
    await this.logService.logInfo('core', `Ensuring profile is running: ${profile.name}`, {
      profileId,
      profileName: profile.name,
      currentStatus: profile.status,
      existingPort: profile.remoteDebuggingPort,
    })

    // If profile is already running, stop it first to ensure clean start
    if (profile.status === 'running') {
      await this.logService.logInfo('core', `Profile is marked as running, stopping first to ensure clean start`, {
        profileId,
        profileName: profile.name,
        oldPort: profile.remoteDebuggingPort,
      })
      try {
        await this.stopProfile(profileId)
        // Wait a moment after stopping
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        // Log but continue - profile might already be stopped
        await this.logService.logWarning('core', `Failed to stop profile before restart, continuing anyway`, {
          profileId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Start the profile fresh
    await this.logService.logInfo('core', `Starting profile for browser connection: ${profile.name}`, {
      profileId,
      profileName: profile.name,
    })

    const startedProfile = await this.startProfile(profileId)

    if (!startedProfile.remoteDebuggingPort) {
      throw new Error(`Failed to get remote debugging port for profile ${profileId}`)
    }

    await this.logService.logInfo('core', `Profile started successfully, got remote debugging port: ${startedProfile.remoteDebuggingPort}`, {
      profileId,
      profileName: profile.name,
      port: startedProfile.remoteDebuggingPort,
    })

    // Wait longer for the remote debugging port to be ready
    // GPMLogin sometimes needs more time after starting before the port is accessible
    const waitTime = 3000 // 3 seconds
    await this.logService.logInfo('core', `Waiting ${waitTime}ms for remote debugging port to be ready...`, {
      profileId,
      port: startedProfile.remoteDebuggingPort,
    })
    await new Promise((resolve) => setTimeout(resolve, waitTime))

    await this.logService.logInfo('core', `Remote debugging port should be ready now: ${startedProfile.remoteDebuggingPort}`, {
      profileId,
      port: startedProfile.remoteDebuggingPort,
    })

    return {
      host: '127.0.0.1',
      port: startedProfile.remoteDebuggingPort,
    }
  }

  /**
   * Delete profile from GPMLogin and database
   * First deletes from GPMLogin, then from database
   */
  async deleteProfile(id: string): Promise<void> {
    const profile = await this.getProfile(id)
    if (!profile) {
      throw new Error('Profile not found')
    }

    try {
      const browserProvider = profile.browserProvider || 'gpmlogin'

      // Delete from browser provider first
      if (browserProvider === 'gpmlogin' || browserProvider === 'gpmlogin_global') {
        const adapter = await this.getGpmAdapterForProfile(id)
        const success = await adapter.deleteProfile(profile.profileUid)
        if (!success) {
          throw new Error('Failed to delete profile from GPMLogin')
        }
      } else if (browserProvider === 'chrome' || browserProvider === 'firefox') {
        // For Chrome/Firefox, delete the profile folder from disk
        if (profile.profilePath) {
          // First, ensure profile is stopped before deleting
          if (profile.status === 'running' && profile.processId) {
            await this.logService.logInfo('core', `Stopping profile before deletion: ${profile.name}`, {
              profileId: id,
              processId: profile.processId,
            })
            try {
              if (browserProvider === 'chrome') {
                await this.chromeAdapter.stopProfile(profile.processId, profile.profilePath, profile.remoteDebuggingPort || undefined)
              } else if (browserProvider === 'firefox') {
                await this.firefoxAdapter.stopProfile(profile.processId)
              }
            } catch (stopError) {
              await this.logService.logWarning('core', `Failed to stop profile before deletion, continuing anyway`, {
                profileId: id,
                error: stopError instanceof Error ? stopError.message : String(stopError),
              })
            }
          }

          try {
            const fs = await import('fs/promises')

            // Check if profile folder exists
            try {
              const stats = await fs.stat(profile.profilePath)
              if (stats.isDirectory()) {
                // Delete profile folder recursively
                await fs.rm(profile.profilePath, { recursive: true, force: true })
                await this.logService.logInfo('core', `Profile folder deleted successfully: ${profile.profilePath}`, {
                  profileId: id,
                  profilePath: profile.profilePath,
                  browserProvider,
                })
              } else {
                await this.logService.logWarning('core', `Profile path exists but is not a directory: ${profile.profilePath}`, {
                  profileId: id,
                  profilePath: profile.profilePath,
                })
              }
            } catch (statError: any) {
              if (statError.code === 'ENOENT') {
                // Folder doesn't exist, that's okay
                await this.logService.logInfo('core', `Profile folder does not exist (already deleted or never created): ${profile.profilePath}`, {
                  profileId: id,
                  profilePath: profile.profilePath,
                })
              } else {
                throw statError
              }
            }
          } catch (fsError) {
            // Log but don't fail if folder deletion fails (folder might be in use)
            await this.logService.logWarning('core', `Could not delete profile folder (may be in use): ${profile.profilePath}`, {
              profileId: id,
              profilePath: profile.profilePath,
              error: fsError instanceof Error ? fsError.message : String(fsError),
            })
            // Don't throw error - continue with database deletion
          }
        }
      }

      // Delete from database
      await prisma.profile.delete({
        where: { id },
      })

      await this.logService.logInfo('core', `Profile deleted: ${profile.name}`, {
        profileId: id,
        profileUid: profile.profileUid,
        browserProvider,
      })
    } catch (error) {
      await this.logService.logError('core', `Error deleting profile: ${profile.name}`, {
        profileId: id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Syncs the locally saved proxyId to the GPMLogin API adapter.
   * Useful when an Account updates the proxy and we want the browser to reflect the new proxy.
   */
  async syncProxyToGpm(profileId: string, proxyId: string | null): Promise<boolean> {
    try {
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
      })
      
      // Need profile uid to interact with GPM Login
      if (!profile || !profile.profileUid) {
        return false
      }
      
      // If browser provider is not GPM Login, we don't need to sync to GPM Login app
      if (
        profile.browserProvider !== 'gpmlogin' && 
        profile.browserProvider !== 'gpmlogin_global' && 
        profile.browserProvider !== null
      ) {
        return false
      }
      
      let rawProxy: string | null = null
      if (proxyId) {
        const proxy = await prisma.proxy.findUnique({
          where: { id: proxyId }
        })
        if (proxy && proxy.rawProxy) {
          rawProxy = proxy.rawProxy
        }
      }
      
      const adapter = await this.getGpmAdapterForProfile(profileId)
      return await adapter.updateProfileProxy(profile.profileUid, rawProxy, profile.name)
    } catch (err) {
      console.error(`Error in ProfileService.syncProxyToGpm for profile ${profileId}:`, err)
      return false
    }
  }

  /**
   * Tự động mở Start URL theo loại cấu hình của Account (Phase 5)
   */
  private async openAccountStartupUrl(profileId: string, port: number, accountId?: string) {
    try {
      let account;
      
      if (accountId) {
        account = await prisma.account.findUnique({
          where: { id: accountId },
          include: { AccountType: true }
        });
      }

      if (!account) {
        // Fallback: If no target accountId generated, try finding the non-gmail main account first
        const profile = await prisma.profile.findUnique({
          where: { id: profileId },
          include: {
            accounts: {
              include: { AccountType: true }
            }
          }
        })
        if (!profile || profile.accounts.length === 0) return
        
        // Prioritize finding the platform account over the generic gmail email account
        account = profile.accounts.find(a => a.accountType !== 'gmail') || profile.accounts[0]
      }

      // Priority 1: Custom URL on individual account
      let startUrl = account.customLoginUrl
      
      // Priority 2: URL from Account Type
      if (!startUrl) {
        startUrl = (account.AccountType as any)?.loginUrl
      }

      // Priority 3: Auto-detect/Dictionary fallback
      if (!startUrl && account.accountType) {
        // Auto-detect domain like 'blink.new' or 'anything.com'
        if (account.accountType.includes('.')) {
          startUrl = `https://${account.accountType}`
        } else {
          // Fallbacks for specific popular types
          const dictionary: Record<string, string> = {
            facebook: 'https://facebook.com',
            x: 'https://x.com',
            google: 'https://google.com',
            gmail: 'https://mail.google.com',
            outlook: 'https://outlook.com',
            coingecko: 'https://coingecko.com',
          }
          startUrl = dictionary[account.accountType.toLowerCase()]
        }
      }

      if (startUrl) {
        // Replace variables: {identifier}, {label}, {id}, {password}
        startUrl = startUrl.replace(/{identifier}/g, account.identifier || '')
                          .replace(/{label}/g, account.label || '')
                          .replace(/{id}/g, account.id || '')

        try {
          const { chromium } = await import('playwright')
          const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
          const context = browser.contexts()[0] || browser.contexts()[browser.contexts().length - 1]
          const pages = context ? context.pages() : []
          const page = pages.length > 0 ? pages[0] : await browser.newPage()
          
          // Wait for navigation so that the CDP connection isn't aborted prematurely.
          // We use domcontentloaded to be fast but ensure the request is fully sent.
          await page.goto(startUrl, { timeout: 20000, waitUntil: 'domcontentloaded' }).catch((e: Error) => {
            console.error(`Error navigating to startup url ${startUrl}:`, e)
          })
          
          await browser.close()
        } catch (err) {
          console.error("Playwright CDP auto startup url error:", err)
        }
      }
    } catch (error) {
      console.error("Failed to process account startup url:", error)
    }
  }
}


