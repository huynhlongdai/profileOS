import { prisma } from '@/lib/prisma'
import { LogService } from './LogService'
import { ProxyService } from './ProxyService'
import { PluginManager } from '../plugins/PluginManager'
import { ChangeHistoryService } from './ChangeHistoryService'
import type { Account, Prisma } from '@prisma/client'

export interface CreateAccountPayload {
  label: string
  accountType: string
  identifier: string
  passwordEncrypted?: string
  twoFactorSecret?: string
  loginMethod?: string // 'PASSWORD' | 'GOOGLE_OAUTH'
  authViaAccountId?: string | null // Link to parent account for shared login/profile
  gpmloginProfileId?: string
  proxyId?: string
  autoChangeProxy?: boolean
  notes?: string
  autoCreateProfile?: boolean // If true, automatically create a profile for this account
  autoCreateProfileGroupId?: string // Group ID for auto-created profile
  autoCreateProfileBrowserType?: string // Browser type for auto-created profile: 'chromium' | 'firefox' | 'gpm'
  autoCreateProfileBrowserProvider?: string // Browser provider for auto-created profile: 'gpmlogin' | 'gpmlogin_global' | 'chrome' | 'firefox'
  customLoginUrl?: string // Manual startup URL for this specific account
}

export interface UpdateAccountPayload {
  label?: string
  accountType?: string // Account type name (e.g., 'gmail', 'coingecko')
  passwordEncrypted?: string
  twoFactorSecret?: string
  gpmloginProfileId?: string
  proxyId?: string
  autoChangeProxy?: boolean
  notes?: string
  status?: string
  loginMethod?: string
  authViaAccountId?: string | null
  customLoginUrl?: string | null
}

export class AccountService {
  private logService: LogService
  private proxyService: ProxyService
  private pluginManager: PluginManager
  private changeHistoryService: ChangeHistoryService

  constructor() {
    this.logService = new LogService()
    this.proxyService = new ProxyService()
    this.pluginManager = PluginManager.getInstance()
    this.changeHistoryService = new ChangeHistoryService()
  }

  /**
   * List accounts with filters
   */
  async listAccounts(filter?: {
    status?: string
    type?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<{ accounts: Account[]; total: number }> {
    const page = filter?.page || 1
    // BUG-4 FIX: tăng default limit từ 100 lên 10000 → tránh mất data khi có nhiều accounts
    const limit = filter?.limit || 10000
    const skip = (page - 1) * limit

    // DEBUG: Log filter parameters
    console.log('[AccountService.listAccounts] Filter parameters:', {
      status: filter?.status,
      type: filter?.type,
      search: filter?.search,
      page,
      limit,
    })

    const where: Prisma.AccountWhereInput = {}
    if (filter?.status) where.status = filter.status
    if (filter?.type) where.accountType = filter.type
    if (filter?.search) {
      where.OR = [
        { label: { contains: filter.search } },
        { identifier: { contains: filter.search } },
      ]
    }

    // DEBUG: Log WHERE condition
    console.log('[AccountService.listAccounts] WHERE condition:', JSON.stringify(where, null, 2))

    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          proxy: true,
          profile: {
            include: {
              proxy: true, // Include proxy from profile
            },
          },
        },
      }),
      prisma.account.count({ where }),
    ])

    return { accounts, total }
  }

  /**
   * Get account with login account (helper for linked accounts)
   * Returns the account itself and the account used for login (parent if authViaAccountId is set)
   */
  async getAccountWithLoginAccount(accountId: string): Promise<{
    account: Awaited<ReturnType<typeof prisma.account.findUnique>>
    loginAccount: Awaited<ReturnType<typeof prisma.account.findUnique>>
  }> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      throw new Error('Account not found')
    }

    // If account has authViaAccountId, use parent account as loginAccount
    if (account.authViaAccountId) {
      const loginAccount = await prisma.account.findUnique({
        where: { id: account.authViaAccountId },
      })

      // If parent is not found, fallback to account itself
      if (loginAccount) {
        return { account, loginAccount }
      }
    }

    // If no authViaAccountId or parent not found, loginAccount = account
    return { account, loginAccount: account }
  }

  /**
   * Get account by ID
   */
  async getAccount(id: string): Promise<Account | null> {
    return prisma.account.findUnique({
      where: { id },
      include: {
        proxy: true,
        profile: {
          include: {
            proxy: true, // Include proxy from profile
          },
        },
        moduleStatuses: true,
      },
    })
  }

  /**
   * Generate label automatically if not provided
   * Format: 4 số tăng dần (ví dụ: 0001, 0002, 0003)
   */
  private async generateLabel(accountType: string): Promise<string> {
    // Find all accounts and extract numeric labels
    const allAccounts = await prisma.account.findMany({
      select: { label: true },
      orderBy: { createdAt: 'asc' },
    })

    // Extract sequence numbers from labels (4-digit numbers)
    let maxSequence = 0
    for (const account of allAccounts) {
      // Check if label is a 4-digit number
      const labelMatch = account.label.match(/^(\d{4})$/)
      if (labelMatch) {
        const seq = parseInt(labelMatch[1], 10)
        if (seq > maxSequence) {
          maxSequence = seq
        }
      }
    }

    // Increment sequence (start from 1 if no accounts)
    const nextSequence = maxSequence + 1
    return String(nextSequence).padStart(4, '0')
  }

  /**
   * Create new account
   * If autoCreateProfile is true, automatically creates a profile and assigns it to the account
   */
  async createAccount(payload: CreateAccountPayload): Promise<Account> {
    // Always generate label automatically (ignore user input)
    const label = await this.generateLabel(payload.accountType)

    let profileId = payload.gpmloginProfileId || null

    // Auto-create profile if requested
    if (payload.autoCreateProfile && !profileId) {
      try {
        const { ProfileService } = await import('./ProfileService')
        const profileService = new ProfileService()

        // Create profile with format: accountType-name
        // Extract username from identifier (email) if it contains @
        let profileNamePart = payload.identifier
        if (profileNamePart.includes('@')) {
          profileNamePart = profileNamePart.split('@')[0]
        }
        // Format: accountType-name (e.g., gmail-username, outlook-username)
        const profileName = `${payload.accountType}-${profileNamePart}`
        const profile = await profileService.createProfile({
          name: profileName,
          proxyId: payload.proxyId || null,
          autoResetIp: payload.autoChangeProxy || false, // Use autoChangeProxy from account
          groupId: payload.autoCreateProfileGroupId || null,
          browserType: payload.autoCreateProfileBrowserType || 'gpm', // Default to gpm
          browserProvider: payload.autoCreateProfileBrowserProvider || 'gpmlogin', // Default to gpmlogin
        })

        profileId = profile.id

        await this.logService.logInfo('core', `Auto-created profile for account: ${label}`, {
          accountLabel: label,
          profileId: profile.id,
          profileName: profileName,
          groupId: payload.autoCreateProfileGroupId || null,
          autoResetIp: payload.autoChangeProxy || false,
          browserType: payload.autoCreateProfileBrowserType || 'chromium',
        })
      } catch (error) {
        const provider = payload.autoCreateProfileBrowserProvider || 'gpmlogin'
        const errMsg = error instanceof Error ? error.message : String(error)
        await this.logService.logError('core', `Failed to auto-create profile for account: ${label}`, {
          error: errMsg,
          browserProvider: provider,
          browserType: payload.autoCreateProfileBrowserType || 'gpm',
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
        })
        // Re-throw so the user sees the actual error instead of silently creating account without profile
        throw new Error(`Không thể tạo profile trên ${provider}: ${errMsg}`)
      }
    }

    const account = await prisma.account.create({
      data: {
        label,
        accountType: payload.accountType,
        identifier: payload.identifier,
        passwordEncrypted: payload.passwordEncrypted || null,
        twoFactorSecret: payload.twoFactorSecret || null,
        loginMethod: payload.loginMethod || 'PASSWORD',
        authViaAccountId: payload.authViaAccountId || null,
        gpmloginProfileId: profileId,
        // Only set proxy and autoChangeProxy if auto-creating profile
        // If using existing profile, proxy comes from profile
        proxyId: payload.autoCreateProfile ? (payload.proxyId || null) : null,
        autoChangeProxy: payload.autoCreateProfile ? (payload.autoChangeProxy || false) : false,
        notes: payload.notes || null,
        customLoginUrl: payload.customLoginUrl || null,
        status: 'active',
      },
      include: {
        proxy: true,
        profile: {
          include: {
            proxy: true, // Include proxy from profile
          },
        },
      },
    })

    await this.logService.logInfo('core', `Account created: ${label}`, {
      accountId: account.id,
      accountType: payload.accountType,
      profileId: account.gpmloginProfileId,
      autoCreatedProfile: payload.autoCreateProfile || false,
      labelAutoGenerated: !payload.label?.trim(),
    })

    return account
  }

  /**
   * Update account
   */
  async updateAccount(id: string, payload: UpdateAccountPayload): Promise<Account> {
    // Lấy account hiện tại để so sánh
    const oldAccount = await prisma.account.findUnique({
      where: { id },
      include: {
        proxy: { select: { label: true } },
        profile: { select: { name: true } },
      },
    })

    if (!oldAccount) {
      throw new Error(`Account not found: ${id}`)
    }

    // Prepare update data
    const updateData: any = { ...payload }

    // If accountType is provided, find and set accountTypeId
    if (payload.accountType !== undefined) {
      updateData.accountType = payload.accountType

      // Find AccountType by name
      const accountType = await prisma.accountType.findUnique({
        where: { name: payload.accountType.toLowerCase() },
      })

      if (accountType) {
        updateData.accountTypeId = accountType.id
      } else {
        // If account type doesn't exist, set accountTypeId to null
        // This handles custom account types that may not be in AccountType table
        updateData.accountTypeId = null
      }
    }

    // Update account
    const account = await prisma.account.update({
      where: { id },
      data: updateData,
      include: {
        proxy: true,
        profile: {
          include: {
            proxy: true,
          },
        },
      },
    })

    // ── Sync proxy to linked profile ────────────────────────────────────────
    // If proxyId changed and account is linked to a profile, update profile.proxyId too
    // (GPMLogin uses profile.proxyId when launching the browser)
    if (
      payload.proxyId !== undefined &&
      payload.proxyId !== oldAccount.proxyId &&
      oldAccount.gpmloginProfileId
    ) {
      try {
        const { ProfileService } = await import('./ProfileService')
        const profileService = new ProfileService()

        // Use ProfileService.getProfile which supports fallback by profileUid
        const oldProfile = await profileService.getProfile(oldAccount.gpmloginProfileId)

        if (oldProfile) {
          await prisma.profile.update({
            where: { id: oldProfile.id },
            data: { proxyId: payload.proxyId || null },
          })

          // Ghi lịch sử thay đổi proxy của profile
          await this.changeHistoryService.recordProfileChange({
            profileId: oldProfile.id,
            changeType: 'proxy',
            fieldName: 'proxyId',
            oldValue: oldProfile.proxyId || null,
            newValue: payload.proxyId || null,
            description: `Proxy synced from account ${oldAccount.label}: "${oldProfile.proxy?.label || 'None'}" → "${account.proxy?.label || 'None'}"`,
          })

          // Tell GPMLogin app to update its proxy
          await profileService.syncProxyToGpm(oldProfile.id, payload.proxyId || null)

          await this.logService.logInfo('core', `Profile proxy synced from account ${oldAccount.label}`, {
            profileId: oldProfile.id,
            accountId: id,
            oldProxyId: oldProfile.proxyId,
            newProxyId: payload.proxyId || null,
          })
        } else {
          await this.logService.logInfo('core', `Proxy sync skipped: profile not found for gpmloginProfileId=${oldAccount.gpmloginProfileId}`, { accountId: id })
        }
      } catch (err) {
        console.error(`Error syncing proxy to GPMLogin app after account update:`, err)
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Ghi lại lịch sử thay đổi
    await this.recordAccountChanges(oldAccount, account, payload)

    await this.logService.logInfo('core', `Account updated: ${id}`, {
      accountId: id,
    })

    return account
  }

  /**
   * Ghi lại các thay đổi của account
   */
  private async recordAccountChanges(
    oldAccount: Account & { proxy: { label: string } | null; profile: { name: string } | null },
    newAccount: Account & { proxy: { label: string } | null; profile: { name: string } | null },
    payload: UpdateAccountPayload
  ): Promise<void> {
    // Account type change
    if (payload.accountType !== undefined && payload.accountType !== oldAccount.accountType) {
      await this.changeHistoryService.recordAccountChange({
        accountId: oldAccount.id,
        changeType: 'other',
        fieldName: 'accountType',
        oldValue: oldAccount.accountType,
        newValue: payload.accountType,
        description: `Account type changed from "${oldAccount.accountType}" to "${payload.accountType}"`,
      })
    }

    // Password change
    if (payload.passwordEncrypted !== undefined && payload.passwordEncrypted !== oldAccount.passwordEncrypted) {
      await this.changeHistoryService.recordAccountChange({
        accountId: oldAccount.id,
        changeType: 'password',
        fieldName: 'passwordEncrypted',
        oldValue: oldAccount.passwordEncrypted ? '[REDACTED]' : null,
        newValue: payload.passwordEncrypted ? '[REDACTED]' : null,
        description: 'Password changed',
      })
    }

    // Profile change
    if (payload.gpmloginProfileId !== undefined && payload.gpmloginProfileId !== oldAccount.gpmloginProfileId) {
      const oldProfileName = oldAccount.profile?.name || 'None'
      const newProfileName = newAccount.profile?.name || 'None'
      await this.changeHistoryService.recordAccountChange({
        accountId: oldAccount.id,
        changeType: 'profile',
        fieldName: 'gpmloginProfileId',
        oldValue: oldAccount.gpmloginProfileId || null,
        newValue: payload.gpmloginProfileId || null,
        description: `Profile changed from "${oldProfileName}" to "${newProfileName}"`,
      })
    }

    // Proxy change
    if (payload.proxyId !== undefined && payload.proxyId !== oldAccount.proxyId) {
      const oldProxyLabel = oldAccount.proxy?.label || 'None'
      const newProxyLabel = newAccount.proxy?.label || 'None'
      await this.changeHistoryService.recordAccountChange({
        accountId: oldAccount.id,
        changeType: 'proxy',
        fieldName: 'proxyId',
        oldValue: oldAccount.proxyId || null,
        newValue: payload.proxyId || null,
        description: `Proxy changed from "${oldProxyLabel}" to "${newProxyLabel}"`,
      })
    }

    // Status change
    if (payload.status !== undefined && payload.status !== oldAccount.status) {
      await this.changeHistoryService.recordAccountChange({
        accountId: oldAccount.id,
        changeType: 'status',
        fieldName: 'status',
        oldValue: oldAccount.status,
        newValue: payload.status,
        description: `Status changed from "${oldAccount.status}" to "${payload.status}"`,
      })
    }

    // Notes change
    if (payload.notes !== undefined && payload.notes !== oldAccount.notes) {
      await this.changeHistoryService.recordAccountChange({
        accountId: oldAccount.id,
        changeType: 'notes',
        fieldName: 'notes',
        oldValue: oldAccount.notes || null,
        newValue: payload.notes || null,
        description: 'Notes updated',
      })
    }

    // 2FA change
    if (payload.twoFactorSecret !== undefined && payload.twoFactorSecret !== oldAccount.twoFactorSecret) {
      await this.changeHistoryService.recordAccountChange({
        accountId: oldAccount.id,
        changeType: '2fa',
        fieldName: 'twoFactorSecret',
        oldValue: oldAccount.twoFactorSecret ? '[REDACTED]' : null,
        newValue: payload.twoFactorSecret ? '[REDACTED]' : null,
        description: '2FA secret key changed',
      })
    }

    // Label change
    if (payload.label !== undefined && payload.label !== oldAccount.label) {
      await this.changeHistoryService.recordAccountChange({
        accountId: oldAccount.id,
        changeType: 'label',
        fieldName: 'label',
        oldValue: oldAccount.label,
        newValue: payload.label,
        description: `Label changed from "${oldAccount.label}" to "${payload.label}"`,
      })
    }
  }

  /**
   * Delete account
   */
  async deleteAccount(id: string): Promise<void> {
    await prisma.account.delete({
      where: { id },
    })

    await this.logService.logInfo('core', `Account deleted: ${id}`, {
      accountId: id,
    })
  }

  /**
   * Assign proxy to account
   */
  async assignProxy(accountId: string, proxyId: string): Promise<void> {
    await prisma.account.update({
      where: { id: accountId },
      data: { proxyId },
    })

    await this.logService.logInfo('core', `Proxy assigned to account`, {
      accountId,
      proxyId,
    })
  }

  /**
   * Assign profile to account
   */
  async assignProfile(accountId: string, profileId: string): Promise<void> {
    await prisma.account.update({
      where: { id: accountId },
      data: { gpmloginProfileId: profileId },
    })

    await this.logService.logInfo('core', `Profile assigned to account`, {
      accountId,
      profileId,
    })
  }

  /**
   * Trigger check for account via PluginManager
   */
  async triggerCheck(accountId: string): Promise<void> {
    const account = await this.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    await this.logService.logInfo('core', `Check triggered for account`, {
      accountId,
      accountType: account.accountType,
    })

    // Update lastCheck timestamp
    await prisma.account.update({
      where: { id: accountId },
      data: { lastCheck: new Date() },
    })

    // Call PluginManager to handle the check
    await this.pluginManager.checkAccount(accountId)
  }

  /**
   * Trigger care for account via PluginManager
   * 
   * NOTE: lastCare should be updated by the plugin AFTER successful care,
   * not here. This allows retry if plugin fails.
   */
  async triggerCare(accountId: string): Promise<void> {
    const account = await this.getAccount(accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    await this.logService.logInfo('core', `Care triggered for account`, {
      accountId,
      accountType: account.accountType,
    })

    // Call PluginManager to handle the care
    // Plugin will update lastCare after successful care
    await this.pluginManager.careAccount(accountId)
  }

  /**
   * Bulk check accounts - uses TaskService for queue management
   */
  async bulkCheck(accountIds: string[]): Promise<void> {
    await this.logService.logInfo('core', `Bulk check triggered`, {
      accountCount: accountIds.length,
    })

    // Use TaskService for better queue management
    const { TaskService } = await import('./TaskService')
    const { AppConfigService } = await import('./AppConfigService')
    const taskService = new TaskService(this, new AppConfigService(), new LogService())
    await taskService.enqueueCheck(accountIds)
  }

  /**
   * Bulk care accounts - uses TaskService for queue management
   */
  async bulkCare(accountIds: string[]): Promise<void> {
    console.log(`[AccountService] Bulk care triggered for ${accountIds.length} accounts`)
    await this.logService.logInfo('core', `Bulk care triggered`, {
      accountCount: accountIds.length,
    })

    // Use TaskService for better queue management
    const { TaskService } = await import('./TaskService')
    const { AppConfigService } = await import('./AppConfigService')
    const taskService = new TaskService(this, new AppConfigService(), new LogService())
    console.log(`[AccountService] Enqueuing care tasks...`)
    await taskService.enqueueCare(accountIds)
    console.log(`[AccountService] Care tasks enqueued successfully`)
  }

  /**
   * Save cookies for account
   */
  async saveCookies(accountId: string, cookies: any[]): Promise<void> {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        cookiesJson: JSON.stringify(cookies),
      },
    })

    await this.logService.logInfo('core', `Cookies saved for account`, {
      accountId,
      cookieCount: cookies.length,
    })
  }

  /**
   * Get cookies for account
   */
  async getCookies(accountId: string): Promise<any[] | null> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { cookiesJson: true },
    })

    if (!account || !account.cookiesJson) {
      return null
    }

    try {
      return JSON.parse(account.cookiesJson)
    } catch {
      return null
    }
  }
}

