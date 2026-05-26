/**
 * Plugin interface that all account plugins must implement
 */
export interface AccountPlugin {
  name: string
  supportedTypes: string[] // e.g. ['gmail']
  version?: string
  description?: string

  /**
   * Check account status (logged in, logged out, error, etc.)
   */
  checkAccount(accountId: string): Promise<void>

  /**
   * Perform care actions (read emails, interact, etc.)
   */
  careAccount(accountId: string): Promise<void>

  /**
   * Login account (optional, some plugins may not need this)
   */
  loginAccount?(accountId: string): Promise<void>
}

/**
 * Plugin metadata from plugin.json
 */
export interface PluginMetadata {
  name: string
  version: string
  description: string
  entry: string
  enabled?: boolean
}

