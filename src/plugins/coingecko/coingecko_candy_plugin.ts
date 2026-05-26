/**
 * CoinGecko Candy Plugin Factory
 * 
 * Creates CoinGeckoCandyPlugin instance with dependency injection
 */

import type { AccountPlugin } from '@/core/plugins/types'
import { CoinGeckoCandyService } from './CoinGeckoCandyService'
import type { PrismaClient } from '@prisma/client'
import type { ProfileService } from '@/core/services/ProfileService'
import type { BrowserController } from '@/integrations/BrowserController'
import type { LogService } from '@/core/services/LogService'
import type { ModuleService } from '@/core/services/ModuleService'

import type { AccountService } from '@/core/services/AccountService'

export interface CoinGeckoCandyPluginDeps {
  prisma: PrismaClient
  profileService: ProfileService
  browserController: BrowserController
  logService: LogService
  moduleService: ModuleService
  accountService: AccountService
}

/**
 * Factory function to create CoinGeckoCandyPlugin with dependency injection
 */
export function createCoinGeckoCandyPlugin(deps: CoinGeckoCandyPluginDeps): AccountPlugin {
  const service = new CoinGeckoCandyService(
    deps.prisma,
    deps.profileService,
    deps.browserController,
    deps.logService,
    deps.moduleService,
    deps.accountService
  )

  return {
    name: 'coingecko_candy',
    supportedTypes: ['coingecko'],

    async checkAccount(accountId: string) {
      await service.checkCandyStatus(accountId)
    },

    async careAccount(accountId: string) {
      // Use careAccount as "claim candy"
      await service.claimCandyForAccount(accountId)
    },

    async loginAccount(accountId: string) {
      // For CoinGecko, login is handled during claim
      // Or we can reuse claimCandyForAccount which handles login
      await service.claimCandyForAccount(accountId)
    },
  }
}

