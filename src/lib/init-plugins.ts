import { PluginManager } from '@/core/plugins/PluginManager'
import { createGmailPlugin } from '@/plugins/gmail/gmail_plugin'
import { prisma } from '@/lib/prisma'
import { LogService } from '@/core/services/LogService'
import { ProfileService } from '@/core/services/ProfileService'
import { ModuleService } from '@/core/services/ModuleService'
import { PlaywrightBrowserController } from '@/integrations/BrowserController'

// Track if plugins have been initialized
let pluginsInitialized = false

/**
 * Initialize and register all plugins
 * This should be called at application startup
 * 
 * Uses factory pattern for dependency injection
 * Safe to call multiple times - will only initialize once
 */
export function initPlugins() {
  // Prevent multiple initializations
  if (pluginsInitialized) {
    return
  }

  const pluginManager = PluginManager.getInstance()

  // Check if Gmail plugin is already registered
  const existingPlugin = pluginManager.getPluginForAccountTypeSync('gmail')
  if (existingPlugin) {
    pluginsInitialized = true
    return
  }

  // Initialize services (singleton instances)
  const logService = new LogService()
  const profileService = new ProfileService()
  const moduleService = new ModuleService()
  const browserController = new PlaywrightBrowserController()

  // Create Gmail plugin with dependency injection
  const gmailPlugin = createGmailPlugin({
    prisma,
    profileService,
    browserController,
    logService,
    moduleService,
  })

  // Register Gmail plugin
  pluginManager.registerPlugin(gmailPlugin)

  pluginsInitialized = true
  console.log('✅ Gmail plugin registered')

  // TODO: Register other plugins here as they are added
  // const outlookPlugin = createOutlookPlugin({ ... })
  // pluginManager.registerPlugin(outlookPlugin)
}

