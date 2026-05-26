/**
 * GmailService - Handles Gmail-specific operations
 * 
 * Implements AUTOMATION_LAYER_SPEC.md flow
 */

import { prisma } from '@/lib/prisma'
import { LogService } from '@/core/services/LogService'
import { ProfileService } from '@/core/services/ProfileService'
import { ModuleService } from '@/core/services/ModuleService'
import {
  PlaywrightBrowserController,
  type BrowserSession,
  type GmailPageController,
} from '@/integrations/BrowserController'
import { parseGmailConfig, type GmailModuleConfig } from './gmailConfig'
import { GmailCareBehavior } from './GmailCareBehavior'
import type { Account } from '@prisma/client'

/**
 * GmailService - Handles Gmail-specific operations
 * Follows AUTOMATION_LAYER_SPEC.md flow
 */
export class GmailService {
  private logService: LogService
  private profileService: ProfileService
  private browserController: PlaywrightBrowserController
  private moduleService: ModuleService

  constructor(
    logService?: LogService,
    profileService?: ProfileService,
    browserController?: PlaywrightBrowserController,
    moduleService?: ModuleService
  ) {
    this.logService = logService || new LogService()
    this.profileService = profileService || new ProfileService()
    this.browserController = browserController || new PlaywrightBrowserController()
    this.moduleService = moduleService || new ModuleService()
  }

  /**
   * Get Gmail module config from ModuleService
   */
  private async getConfig(): Promise<GmailModuleConfig> {
    const mod = await this.moduleService.getModule('gmail')
    return parseGmailConfig(mod?.configJson)
  }

  /**
   * Decrypt password (currently returns plaintext, TODO: implement encryption)
   */
  private decryptPassword(encrypted: string): string {
    // TODO: hiện tại có thể return plaintext, sau này thay bằng decrypt thực sự
    return encrypted
  }

  /**
   * Calculate minutes difference between two dates
   */
  private minutesDiff(a: Date, b: Date): number {
    return Math.abs(a.getTime() - b.getTime()) / 1000 / 60
  }

  /**
   * Check Gmail account status
   * Flow from AUTOMATION_LAYER_SPEC.md section 3.3
   */
  async checkAccount(accountId: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      throw new Error(`Account not found: ${accountId}`)
    }

    if (account.accountType !== 'gmail') {
      throw new Error(`GmailService only supports gmail accounts`)
    }

    const config = await this.getConfig()

    await this.logService.logInfo('gmail', `Checking Gmail account: ${account.identifier}`, {
      accountId,
    })

    let session: BrowserSession | null = null

    try {
      // 1) Ensure profile
      const profile = await this.profileService.ensureProfileForAccount(account)

      // 2) Ensure running
      const { host, port } = await this.profileService.ensureProfileRunning(profile.id)

      // 3) Connect Browser
      session = await this.browserController.connectByRemoteDebugging(host, port)

      // 4) Open Gmail tab
      const gmailPage = await this.browserController.openGmailTab(session)

      // 5) Check login status
      const status = await gmailPage.checkLoginStatus()

      if (status === 'logged_in') {
        // Update DB
        await prisma.account.update({
          where: { id: account.id },
          data: {
            status: 'active',
            lastCheck: new Date(),
          },
        })

        // Save cookies
        try {
          const cookies = await this.getCookiesFromSession(session)
          if (cookies) {
            const { AccountService } = await import('@/core/services/AccountService')
            const accountService = new AccountService()
            await accountService.saveCookies(accountId, cookies)
          }
        } catch (error) {
          await this.logService.logWarning('gmail', `Failed to save cookies`, {
            accountId,
            error: error instanceof Error ? error.message : String(error),
          })
        }

        await this.logService.logInfo('gmail', `Account ${account.identifier} already logged in`, {
          accountId,
        })
        return
      }

      if (status === 'logged_out') {
        if (config.autoLoginIfLoggedOut) {
          await this.logService.logInfo('gmail', 'Account logged out, auto-login enabled', {
            accountId,
          })
          await this.loginAccount(accountId)
        } else {
          await prisma.account.update({
            where: { id: account.id },
            data: {
              status: 'logged_out',
              lastCheck: new Date(),
            },
          })
          await this.logService.logWarning('gmail', 'Account logged out, auto-login disabled', {
            accountId,
          })
        }
        return
      }

      // unknown status
      await this.logService.logWarning('gmail', 'Unknown login status', { accountId })
      await prisma.account.update({
        where: { id: account.id },
        data: {
          status: 'error',
          lastCheck: new Date(),
        },
      })
    } catch (error) {
      await prisma.account.update({
        where: { id: accountId },
        data: {
          status: 'error',
          lastCheck: new Date(),
        },
      })

      await this.logService.logError('gmail', `Gmail check failed`, {
        accountId,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    } finally {
      if (session) {
        try {
          await session.close()
        } catch (error) {
          console.error('Error closing browser session:', error)
        }
      }
    }
  }

  /**
   * Login Gmail account
   * Flow from AUTOMATION_LAYER_SPEC.md section 3.4
   */
  async loginAccount(accountId: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      throw new Error(`Account not found: ${accountId}`)
    }

    if (account.accountType !== 'gmail') {
      throw new Error(`Not a gmail account`)
    }

    if (!account.passwordEncrypted) {
      await this.logService.logError('gmail', 'No password stored for login', { accountId })
      return
    }

    const password = this.decryptPassword(account.passwordEncrypted)

    const profile = await this.profileService.ensureProfileForAccount(account)
    const { host, port } = await this.profileService.ensureProfileRunning(profile.id)

    const session = await this.browserController.connectByRemoteDebugging(host, port)

    try {
      const gmailPage = await this.browserController.openGmailTab(session)
      await gmailPage.performLogin(account.identifier, password)

      await prisma.account.update({
        where: { id: account.id },
        data: {
          status: 'active',
          lastLogin: new Date(),
          lastCheck: new Date(),
        },
      })

      // Save cookies
      try {
        const cookies = await this.getCookiesFromSession(session)
        if (cookies) {
          const { AccountService } = await import('@/core/services/AccountService')
          const accountService = new AccountService()
          await accountService.saveCookies(accountId, cookies)
        }
      } catch (error) {
        await this.logService.logWarning('gmail', `Failed to save cookies after login`, {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      await this.logService.logInfo('gmail', 'Login success', {
        accountId,
        identifier: account.identifier,
      })
    } catch (err) {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          status: 'error',
        },
      })
      await this.logService.logError('gmail', 'Login failed', {
        accountId,
        identifier: account.identifier,
        error: String(err),
      })
      throw err
    } finally {
      await session.close()
    }
  }

  /**
   * Care Gmail account
   * Flow from AUTOMATION_LAYER_SPEC.md section 3.5
   */
  async careAccount(accountId: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      throw new Error(`Account not found: ${accountId}`)
    }

    if (account.accountType !== 'gmail') {
      throw new Error(`Not a gmail account`)
    }

    const config = await this.getConfig()
    const now = new Date()

    // Check minCareIntervalMinutes
    if (account.lastCare) {
      const diff = this.minutesDiff(now, account.lastCare)
      if (diff < config.minCareIntervalMinutes) {
        await this.logService.logInfo('gmail', 'Skip care: too soon since last care', {
          accountId,
          minutesSinceLastCare: diff,
          minCareIntervalMinutes: config.minCareIntervalMinutes,
        })
        return
      }
    }

    // Check skipCareIfRecentlyLoggedInMinutes
    if (account.lastLogin) {
      const diffLogin = this.minutesDiff(now, account.lastLogin)
      if (diffLogin < config.skipCareIfRecentlyLoggedInMinutes) {
        await this.logService.logInfo('gmail', 'Skip care: recently logged in', {
          accountId,
          minutesSinceLastLogin: diffLogin,
          skipCareIfRecentlyLoggedInMinutes: config.skipCareIfRecentlyLoggedInMinutes,
        })
        return
      }
    }

    let profile
    let session
    let careSuccess = false

    try {
      await this.logService.logInfo('gmail', 'Starting care process', {
        accountId,
        identifier: account.identifier,
      })

      profile = await this.profileService.ensureProfileForAccount(account)
      await this.logService.logInfo('gmail', 'Profile ensured', {
        accountId,
        profileId: profile.id,
      })

      const { host, port } = await this.profileService.ensureProfileRunning(profile.id)
      await this.logService.logInfo('gmail', 'Profile running', {
        accountId,
        profileId: profile.id,
        host,
        port,
      })

      session = await this.browserController.connectByRemoteDebugging(host, port)
      await this.logService.logInfo('gmail', 'Browser session connected', {
        accountId,
        profileId: profile.id,
      })

      const gmailPage = await this.browserController.openGmailTab(session)
      const status = await gmailPage.checkLoginStatus()

      await this.logService.logInfo('gmail', 'Login status checked', {
        accountId,
        status,
      })

      if (status !== 'logged_in') {
        if (config.autoLoginIfLoggedOut) {
          await this.logService.logInfo('gmail', 'Care: account not logged in, auto logging in', {
            accountId,
          })
          await this.loginAccount(accountId)
        } else {
          await this.logService.logWarning(
            'gmail',
            'Care: account not logged in and autoLogin disabled',
            {
              accountId,
            }
          )
          return
        }
      }

      // Perform care behavior using Gmail module's own care logic
      const page = gmailPage.getPage()
      const gmailCare = new GmailCareBehavior(page, {
        email: account.identifier,
        randomBehaviorLevel: config.randomBehaviorLevel,
      })
      
      await this.logService.logInfo('gmail', 'Starting care actions', {
        accountId,
      })

      const careActions = await gmailCare.performCare()
      
      await this.logService.logInfo('gmail', 'Care actions performed', {
        accountId,
        actions: careActions,
      })

      // Save cookies after care (similar to code cũ)
      try {
        const cookies = await this.getCookiesFromSession(session)
        if (cookies) {
          const { AccountService } = await import('@/core/services/AccountService')
          const accountService = new AccountService()
          await accountService.saveCookies(accountId, cookies)
          await this.logService.logInfo('gmail', 'Cookies saved after care', {
            accountId,
            cookieCount: cookies.length,
          })
        }
      } catch (error) {
        await this.logService.logWarning('gmail', `Failed to save cookies after care`, {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        })
        // Cookie save failure should not fail the entire care operation
      }

      // Update lastCare and lastCheck only after successful care
      await prisma.account.update({
        where: { id: account.id },
        data: {
          lastCare: new Date(),
          lastCheck: new Date(),
        },
      })

      careSuccess = true

      await this.logService.logInfo('gmail', 'Care done successfully', {
        accountId,
        identifier: account.identifier,
      })
    } catch (error) {
      // Log error details
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      await this.logService.logError('gmail', 'Care failed', {
        accountId,
        identifier: account.identifier,
        error: errorMessage,
        stack: errorStack,
        profileId: profile?.id,
      })

      // Update account status to error
      try {
        await prisma.account.update({
          where: { id: account.id },
          data: {
            status: 'error',
          },
        })
      } catch (updateError) {
        await this.logService.logWarning('gmail', 'Failed to update account status', {
          accountId,
          error: updateError instanceof Error ? updateError.message : String(updateError),
        })
      }

      // Re-throw error so TaskService can handle it
      throw error
    } finally {
      // Always close session
      if (session) {
        try {
          await session.close()
          await this.logService.logInfo('gmail', 'Browser session closed', {
            accountId,
          })
        } catch (closeError) {
          await this.logService.logWarning('gmail', 'Failed to close browser session', {
            accountId,
            error: closeError instanceof Error ? closeError.message : String(closeError),
          })
        }
      }
    }
  }

  /**
   * Legacy method name for backward compatibility
   */
  async care(accountId: string): Promise<void> {
    return this.careAccount(accountId)
  }

  /**
   * Legacy method name for backward compatibility
   */
  async login(accountId: string): Promise<void> {
    return this.loginAccount(accountId)
  }

  /**
   * Helper to get cookies from session
   * Note: This is a workaround since BrowserSession interface doesn't expose cookies directly
   * In a real implementation, we might need to extend the interface or use a different approach
   */
  private async getCookiesFromSession(session: BrowserSession): Promise<any[] | null> {
    try {
      // Access the internal browser context to get cookies
      // This is a workaround - in production, we might want to add a getCookies() method to BrowserSession
      const playwrightSession = session as any
      const context = playwrightSession.getContext?.()
      if (context) {
        return await context.cookies()
      }
      return null
    } catch (error) {
      console.error('Error getting cookies from session:', error)
      return null
    }
  }
}
