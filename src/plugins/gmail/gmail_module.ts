/**
 * Gmail Plugin - Legacy singleton export for backward compatibility
 * 
 * This file is kept for backward compatibility.
 * New code should use createGmailPlugin from gmail_plugin.ts with dependency injection.
 */

import type { AccountPlugin } from '@/core/plugins/types'
import { createGmailPlugin } from './gmail_plugin'
import { prisma } from '@/lib/prisma'
import { LogService } from '@/core/services/LogService'
import { ProfileService } from '@/core/services/ProfileService'
import { ModuleService } from '@/core/services/ModuleService'
import { PlaywrightBrowserController } from '@/integrations/BrowserController'

/**
 * Create Gmail plugin with default dependencies (singleton pattern)
 * This maintains backward compatibility for code that imports gmail_module
 */
const gmailPlugin: AccountPlugin = createGmailPlugin({
  prisma,
  profileService: new ProfileService(),
  browserController: new PlaywrightBrowserController(),
  logService: new LogService(),
  moduleService: new ModuleService(),
})

// Export plugin instance for backward compatibility
export default gmailPlugin

