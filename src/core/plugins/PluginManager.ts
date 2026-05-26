import type { AccountPlugin, PluginMetadata } from './types'
import { prisma } from '@/lib/prisma'
import { LogService } from '../services/LogService'
import { ModuleService } from '../services/ModuleService'

/**
 * PluginManager - Manages loading and routing to account plugins
 */
export class PluginManager {
  private static instance: PluginManager
  private plugins: Map<string, AccountPlugin> = new Map()
  private logService: LogService
  private moduleService: ModuleService

  private constructor() {
    this.logService = new LogService()
    this.moduleService = new ModuleService()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager()
    }
    return PluginManager.instance
  }

  /**
   * Load plugins from src/plugins directory
   * This will be called at startup
   */
  async loadPlugins(): Promise<void> {
    try {
      // In a real implementation, this would scan the plugins directory
      // For now, we'll manually register plugins
      // TODO: Implement dynamic plugin loading from filesystem

      await this.logService.logInfo('core', 'PluginManager: Loading plugins', {})
    } catch (error) {
      await this.logService.logError('core', 'PluginManager: Error loading plugins', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Register a plugin
   */
  registerPlugin(plugin: AccountPlugin): void {
    for (const type of plugin.supportedTypes) {
      this.plugins.set(type, plugin)
    }
  }

  /**
   * Get plugin for account type (synchronous - doesn't check module enabled state)
   */
  getPluginForAccountTypeSync(type: string): AccountPlugin | null {
    return this.plugins.get(type) || null
  }

  /**
   * Check if module is enabled
   */
  async isModuleEnabled(moduleName: string): Promise<boolean> {
    const mod = await this.moduleService.getModule(moduleName)
    return mod ? mod.enabled : true // default: true nếu chưa config
  }

  /**
   * Get plugin for account type (async - checks module enabled state)
   */
  async getPluginForAccountType(type: string): Promise<AccountPlugin | null> {
    const plugin = this.getPluginForAccountTypeSync(type)
    if (!plugin) return null

    const enabled = await this.isModuleEnabled(plugin.name)
    if (!enabled) return null

    return plugin
  }

  /**
   * Check account using appropriate plugin
   */
  async checkAccount(accountId: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      throw new Error(`Account not found: ${accountId}`)
    }

    const plugin = await this.getPluginForAccountType(account.accountType)
    if (!plugin) {
      throw new Error(`No enabled plugin found for account type: ${account.accountType}`)
    }

    await this.logService.logInfo('core', `Checking account via plugin: ${plugin.name}`, {
      accountId,
      accountType: account.accountType,
    })

    try {
      await plugin.checkAccount(accountId)
    } catch (error) {
      await this.logService.logError('core', `Error checking account`, {
        accountId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Care account using appropriate plugin
   */
  async careAccount(accountId: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      throw new Error(`Account not found: ${accountId}`)
    }

    const plugin = await this.getPluginForAccountType(account.accountType)
    if (!plugin) {
      throw new Error(`No enabled plugin found for account type: ${account.accountType}`)
    }

    await this.logService.logInfo('core', `Caring account via plugin: ${plugin.name}`, {
      accountId,
      accountType: account.accountType,
    })

    try {
      await plugin.careAccount(accountId)
    } catch (error) {
      await this.logService.logError('core', `Error caring account`, {
        accountId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): AccountPlugin[] {
    return Array.from(new Set(this.plugins.values()))
  }
}

