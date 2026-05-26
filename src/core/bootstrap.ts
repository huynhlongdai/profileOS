/**
 * Bootstrap - Khởi tạo và tích hợp tất cả core services
 * 
 * File này tạo và cấu hình tất cả services theo thứ tự dependency:
 * 1. Prisma client
 * 2. Basic services (LogService, AppConfigService, ModuleService)
 * 3. Integration services (ProxyAPI, GpmLogin, BrowserController)
 * 4. Domain services (ProxyService, ProfileService)
 * 5. Plugin system (PluginManager, GmailPlugin)
 * 6. Account service
 * 7. Task engine (TaskService, SchedulerService)
 * 
 * Export singleton instances để các API routes có thể dùng
 */

import { prisma } from '@/lib/prisma'
import { config } from '@/lib/config'
import { LogService } from './services/LogService'
import { AppConfigService } from './services/AppConfigService'
import { ModuleService } from './services/ModuleService'
import { ProxyService } from './services/ProxyService'
import { ProfileService } from './services/ProfileService'
import { AccountService } from './services/AccountService'
import { TaskService } from './services/TaskService'
import { SchedulerService } from './services/SchedulerService'
import { AccountTypeService } from './services/AccountTypeService'
import { ExtensionService } from './services/ExtensionService'
import { PluginManager } from './plugins/PluginManager'
import { createGmailPlugin } from '@/plugins/gmail/gmail_plugin'
import { createCoinGeckoCandyPlugin } from '@/plugins/coingecko/coingecko_candy_plugin'
import { PlaywrightBrowserController } from '@/integrations/BrowserController'

// Singleton instances
let coreServices: {
  logService: LogService
  appConfigService: AppConfigService
  moduleService: ModuleService
  proxyService: ProxyService
  profileService: ProfileService
  accountService: AccountService
  taskService: TaskService
  schedulerService: SchedulerService
  pluginManager: PluginManager
  accountTypeService: AccountTypeService
  extensionService: ExtensionService
} | null = null

let schedulerStarted = false

/**
 * Initialize all core services
 * Safe to call multiple times - returns existing instances if already initialized
 */
export function initCore() {
  if (coreServices) {
    return coreServices
  }

  console.log('[Bootstrap] Initializing core services...')

  // 1. Basic services (stateless - can create new instances)
  const logService = new LogService()
  const appConfigService = new AppConfigService()
  const moduleService = new ModuleService()

  // 2. Integration services
  const browserController = new PlaywrightBrowserController()

  // 3. Domain services (create new instances - they will create their own dependencies)
  const proxyService = new ProxyService()
  const profileService = new ProfileService()

  // 4. Account service (needed by plugins)
  const accountService = new AccountService()

  // 5. Plugin system
  const pluginManager = PluginManager.getInstance()

  // Register Gmail plugin if not already registered
  const existingGmailPlugin = pluginManager.getPluginForAccountTypeSync('gmail')
  if (!existingGmailPlugin) {
    const gmailPlugin = createGmailPlugin({
      prisma,
      profileService,
      browserController,
      logService,
      moduleService,
    })
    pluginManager.registerPlugin(gmailPlugin)
    console.log('[Bootstrap] Gmail plugin registered')
  }

  // Register CoinGecko Candy plugin if not already registered
  const existingCoinGeckoPlugin = pluginManager.getPluginForAccountTypeSync('coingecko')
  if (!existingCoinGeckoPlugin) {
    const coingeckoCandyPlugin = createCoinGeckoCandyPlugin({
      prisma,
      profileService,
      browserController,
      logService,
      moduleService,
      accountService,
    })
    pluginManager.registerPlugin(coingeckoCandyPlugin)
    console.log('[Bootstrap] CoinGecko Candy plugin registered')
  }

  // 6. Task engine services
  // Note: TaskService needs AccountService, AppConfigService, LogService
  // We pass the instances we created above for consistency
  const taskService = new TaskService(accountService, appConfigService, logService)
  const schedulerService = new SchedulerService(taskService, logService)

  // 7. Account Type Service
  const accountTypeService = new AccountTypeService()

  // 8. Extension Service
  const extensionService = new ExtensionService()

  coreServices = {
    logService,
    appConfigService,
    moduleService,
    proxyService,
    profileService,
    accountService,
    taskService,
    schedulerService,
    pluginManager,
    accountTypeService,
    extensionService,
  }

  console.log('[Bootstrap] Core services initialized')
  
  // Initialize default account types (async, don't block)
  ;(async () => {
    try {
      await accountTypeService.initializeDefaultAccountTypes()
      console.log('[Bootstrap] Default account types initialized')
    } catch (error) {
      console.error('[Bootstrap] Error initializing account types:', error)
    }
  })()
  
  // Auto-start scheduler only in non-serverless environments
  // On Vercel, scheduler runs via the local agent instead
  if (!schedulerStarted && !config.app.isVercel) {
    coreServices.schedulerService.start()
    schedulerStarted = true
    console.log('[Bootstrap] Scheduler auto-started')
  } else if (config.app.isVercel) {
    console.log('[Bootstrap] Serverless mode: scheduler disabled (use local agent)')
  }

  return coreServices
}

/**
 * Get core services (initialize if needed)
 */
export function getCore() {
  if (!coreServices) {
    return initCore()
  }
  return coreServices
}

/**
 * Start scheduler (call this at application startup)
 */
export function startScheduler() {
  if (schedulerStarted) {
    console.log('[Bootstrap] Scheduler is already started')
    return
  }

  const core = getCore()
  core.schedulerService.start()
  schedulerStarted = true
  console.log('[Bootstrap] Scheduler started')
}

/**
 * Stop scheduler (call this at application shutdown)
 */
export function stopScheduler() {
  if (!schedulerStarted) {
    return
  }

  const core = getCore()
  core.schedulerService.stop()
  schedulerStarted = false
  console.log('[Bootstrap] Scheduler stopped')
}

/**
 * Export core services object for convenience
 */
export const core = {
  get services() {
    return getCore()
  },
  init: initCore,
  startScheduler,
  stopScheduler,
}

