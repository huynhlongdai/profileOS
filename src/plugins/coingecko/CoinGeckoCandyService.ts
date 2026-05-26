/**
 * CoinGeckoCandyService - Handles CoinGecko Candy claim operations
 * 
 * Implements COINGECKO-PLUGIN.md flow
 */

import { prisma } from '@/lib/prisma'
import { ProfileService } from '@/core/services/ProfileService'
import { AccountService } from '@/core/services/AccountService'
import { LogService } from '@/core/services/LogService'
import { ModuleService } from '@/core/services/ModuleService'
import {
  type BrowserController,
  type BrowserSession,
  type CoinGeckoCandyPageController,
} from '@/integrations/BrowserController'
import {
  CoinGeckoCandyConfig,
  parseCoinGeckoCandyConfig,
} from './candyConfig'
import { CoinGeckoCandyBehavior } from './CoinGeckoCandyBehavior'
import type { Account } from '@prisma/client'

import type { PrismaClient } from '@prisma/client'

export class CoinGeckoCandyService {
  constructor(
    private prisma: PrismaClient,
    private profileService: ProfileService,
    private browserController: BrowserController,
    private logService: LogService,
    private moduleService: ModuleService,
    private accountService: AccountService
  ) { }

  /**
   * Get CoinGecko Candy module config from ModuleService
   */
  private async getConfig(): Promise<CoinGeckoCandyConfig> {
    const mod = await this.moduleService.getModule('coingecko_candy')
    return parseCoinGeckoCandyConfig(mod?.configJson)
  }

  /**
   * Calculate minutes difference between two dates
   */
  private minutesDiff(a: Date, b: Date): number {
    return Math.abs(a.getTime() - b.getTime()) / 1000 / 60
  }

  /**
   * Check if current time is within claim window
   */
  private isWithinClaimWindow(config: CoinGeckoCandyConfig, now: Date): boolean {
    if (config.claimScheduleMode !== 'fixed_window') return true
    const hour = now.getHours()
    if (config.claimStartHour <= config.claimEndHour) {
      return hour >= config.claimStartHour && hour < config.claimEndHour
    }
    // Cross midnight
    return hour >= config.claimStartHour || hour < config.claimEndHour
  }

  /**
   * Claim daily Candy for an account
   */
  async claimCandyForAccount(accountId: string): Promise<void> {
    // 1. Get account and loginAccount (parent if linked)
    const { account, loginAccount } = await this.accountService.getAccountWithLoginAccount(accountId)

    if (!account) throw new Error('Account not found')
    const authAccount = (loginAccount || account) as Account

    if (account.accountType !== 'coingecko') {
      throw new Error("CoinGeckoCandyService chỉ áp dụng cho accountType = 'coingecko'")
    }

    const config = await this.getConfig()
    const now = new Date()

    // 2) Check interval (use account, not loginAccount)
    if (account.lastCandyClaim) {
      const diff = this.minutesDiff(now, account.lastCandyClaim)
      if (diff < config.minClaimIntervalMinutes) {
        await this.logService.logInfo('coingecko_candy', 'Skip claim: too soon since last claim', {
          accountId,
          minutesSinceLastClaim: diff,
          minClaimIntervalMinutes: config.minClaimIntervalMinutes,
        })
        return
      }
    }

    // 3) Check time window
    if (!this.isWithinClaimWindow(config, now)) {
      await this.logService.logInfo('coingecko_candy', 'Skip claim: outside claim window', {
        accountId,
        hour: now.getHours(),
        mode: config.claimScheduleMode,
        start: config.claimStartHour,
        end: config.claimEndHour,
      })
      return
    }

    // 4) Profile + Browser (use authAccount for profile sharing)
    await this.logService.logInfo('coingecko_candy', 'Ensuring profile for account...', {
      accountId,
      authAccountId: authAccount.id,
    })

    const profile = await this.profileService.ensureProfileForAccount(authAccount)
    await this.logService.logInfo('coingecko_candy', 'Profile ensured', {
      accountId,
      profileId: profile.id,
      profileName: profile.name,
      profileUid: profile.profileUid,
    })

    await this.logService.logInfo('coingecko_candy', 'Starting profile to open browser...', {
      accountId,
      profileId: profile.id,
      profileName: profile.name,
    })

    const { host, port } = await this.profileService.ensureProfileRunning(profile.id)
    await this.logService.logInfo('coingecko_candy', 'Profile is running and ready', {
      accountId,
      profileId: profile.id,
      profileName: profile.name,
      host,
      port,
    })

    await this.logService.logInfo('coingecko_candy', 'Connecting to browser via remote debugging...', {
      accountId,
      profileId: profile.id,
      host,
      port,
    })

    const session = await this.browserController.connectByRemoteDebugging(host, port)
    await this.logService.logInfo('coingecko_candy', 'Browser session connected successfully', {
      accountId,
      profileId: profile.id,
    })

    try {
      const candyPage: CoinGeckoCandyPageController =
        await this.browserController.openCoinGeckoCandyPage(session)

      // Get Playwright page for behavior class
      const page = candyPage.getPage()
      const behavior = new CoinGeckoCandyBehavior(page, {
        randomBehaviorLevel: 'medium',
      })

      // Step 1: Kiểm tra trạng thái đăng nhập
      await this.logService.logInfo('coingecko_candy', 'Checking login status...', { accountId })
      const loginStatus = await candyPage.checkLoginStatus()

      // Step 2: Nếu chưa đăng nhập thì tiến hành login
      if (loginStatus === 'logged_out' || loginStatus === 'unknown') {
        if (!config.autoLoginIfLoggedOut) {
          await this.logService.logWarning('coingecko_candy', 'Account logged out and autoLogin disabled', {
            accountId,
          })
          return
        }

        await this.logService.logInfo('coingecko_candy', 'Account not logged in, starting login process...', {
          accountId,
          loginMethod: authAccount.loginMethod,
        })

        // Login based on loginMethod
        if (authAccount.loginMethod === 'GOOGLE_OAUTH') {
          // Login via Google OAuth
          await this.logService.logInfo('coingecko_candy', 'Logging in CoinGecko via Google OAuth...', {
            accountId,
            authAccountId: authAccount.id,
            googleEmail: authAccount.identifier,
          })
          await candyPage.performLoginWithGoogle(authAccount.identifier)

          // Verify login after Google OAuth
          const verifyStatus = await candyPage.checkLoginStatus()
          if (verifyStatus !== 'logged_in') {
            await this.logService.logError('coingecko_candy', 'Google OAuth login failed', {
              accountId,
              finalStatus: verifyStatus,
            })
            return
          }
        } else {
          // PASSWORD method: direct email/password login
          if (!authAccount.passwordEncrypted) {
            await this.logService.logError('coingecko_candy', 'No password for login', { accountId })
            return
          }
          const password = authAccount.passwordEncrypted // TODO: decrypt if needed

          await this.logService.logInfo('coingecko_candy', 'Logging in CoinGecko with email/password...', {
            accountId,
            identifier: authAccount.identifier,
          })
          await candyPage.performLogin(authAccount.identifier, password)

          // Verify login after password login
          const verifyStatus = await candyPage.checkLoginStatus()
          if (verifyStatus !== 'logged_in') {
            await this.logService.logError('coingecko_candy', 'Password login failed', {
              accountId,
              finalStatus: verifyStatus,
            })
            return
          }
        }

        await this.logService.logInfo('coingecko_candy', 'Login successful', { accountId })
      } else {
        await this.logService.logInfo('coingecko_candy', 'Already logged in', { accountId })
      }

      // Step 3: Claim Candy
      await this.logService.logInfo('coingecko_candy', 'Attempting to claim daily candy...', { accountId })
      const claimResult = await candyPage.claimDailyCandy()

      if (claimResult.status === 'already_claimed') {
        await this.logService.logInfo('coingecko_candy', 'Candy already claimed today', {
          accountId,
        })
        // Still update lastCheck (use account, not loginAccount)
        await this.prisma.account.update({
          where: { id: account.id },
          data: {
            lastCheck: new Date(),
          },
        })
      } else if (claimResult.status === 'error') {
        await this.logService.logError('coingecko_candy', 'Failed to claim candy', {
          accountId,
        })
        return
      } else if (claimResult.status === 'claimed') {
        await this.logService.logInfo('coingecko_candy', 'Candy claimed successfully', {
          accountId,
          candyAmount: claimResult.candyAmount,
        })

        // Step 4: Tương tác với website như người thật (random thao tác)
        await this.logService.logInfo('coingecko_candy', 'Performing random human-like interactions...', {
          accountId,
        })
        await behavior.performRandomInteractions()

        // Optional: do missions
        if (config.tryDoMissions) {
          await this.logService.logInfo('coingecko_candy', 'Trying to do missions', { accountId })
          await candyPage.tryCompleteMissions()
          // Add more random interactions after missions
          await behavior.performRandomInteractions()
        }

        // Update DB (use account, not loginAccount)
        await this.prisma.account.update({
          where: { id: account.id },
          data: {
            lastCheck: new Date(),
            lastCandyClaim: new Date(),
            lastCandyAmount: claimResult.candyAmount ?? undefined,
          },
        })
      }
    } finally {
      // Step 5: Đóng profile sau khi hoàn thành
      await this.logService.logInfo('coingecko_candy', 'Closing browser session...', { accountId })
      await session.close()

      // Stop profile (close in GPMLogin)
      try {
        await this.profileService.stopProfile(profile.id)
        await this.logService.logInfo('coingecko_candy', 'Profile closed successfully', {
          accountId,
          profileId: profile.id,
        })
      } catch (error) {
        await this.logService.logWarning('coingecko_candy', 'Failed to close profile', {
          accountId,
          profileId: profile.id,
          error: error instanceof Error ? error.message : String(error),
        })
        // Don't throw - profile might already be closed or error is non-critical
      }
    }
  }

  /**
   * Check Candy status (optional: just read status & log)
   */
  async checkCandyStatus(accountId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } })
    if (!account) throw new Error('Account not found')
    if (account.accountType !== 'coingecko') {
      throw new Error("CoinGeckoCandyService chỉ áp dụng cho accountType = 'coingecko'")
    }

    const profile = await this.profileService.ensureProfileForAccount(account)
    const { host, port } = await this.profileService.ensureProfileRunning(profile.id)

    const session = await this.browserController.connectByRemoteDebugging(host, port)

    try {
      const candyPage = await this.browserController.openCoinGeckoCandyPage(session)
      const loginStatus = await candyPage.checkLoginStatus()

      await this.logService.logInfo('coingecko_candy', 'Checked candy status', {
        accountId,
        loginStatus,
      })

      // Update lastCheck
      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          lastCheck: new Date(),
        },
      })
    } finally {
      await session.close()
    }
  }
}

