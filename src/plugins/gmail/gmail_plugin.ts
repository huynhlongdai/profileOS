/**
 * Gmail Plugin Factory
 * 
 * Creates GmailPlugin instance with dependency injection
 */

import type { AccountPlugin } from '@/core/plugins/types'
import { GmailService } from './GmailService'
import type { PrismaClient } from '@prisma/client'
import type { ProfileService } from '@/core/services/ProfileService'
import type { BrowserController } from '@/integrations/BrowserController'
import type { LogService } from '@/core/services/LogService'
import type { ModuleService } from '@/core/services/ModuleService'

export interface GmailPluginDeps {
  prisma: PrismaClient
  profileService: ProfileService
  browserController: BrowserController
  logService: LogService
  moduleService: ModuleService
}

/**
 * Factory function to create GmailPlugin with dependency injection
 */
export function createGmailPlugin(deps: GmailPluginDeps): AccountPlugin {
  const gmailService = new GmailService(
    deps.logService,
    deps.profileService,
    deps.browserController,
    deps.moduleService
  )

  return {
    name: 'gmail',
    supportedTypes: ['gmail'],

    async checkAccount(accountId: string) {
      await gmailService.checkAccount(accountId)
    },

    async careAccount(accountId: string) {
      await gmailService.careAccount(accountId)
    },

    async loginAccount(accountId: string) {
      await gmailService.loginAccount(accountId)
    },
  }
}

