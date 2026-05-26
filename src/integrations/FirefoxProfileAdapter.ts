import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)

export interface FirefoxProfile {
  id: string
  name: string
  path: string
}

export interface FirefoxProfileInfo {
  name: string
  profilePath: string
  executablePath?: string
}

export class FirefoxProfileAdapter {
  /**
   * Get Firefox Profiles Directory path based on OS
   */
  private getProfilesDirectory(): string {
    const platform = os.platform()
    const homeDir = os.homedir()

    switch (platform) {
      case 'win32':
        return path.join(homeDir, 'AppData', 'Roaming', 'Mozilla', 'Firefox')
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'Firefox')
      case 'linux':
        return path.join(homeDir, '.mozilla', 'firefox')
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  /**
   * Get Firefox executable path based on OS
   */
  private getFirefoxExecutablePath(): string {
    const platform = os.platform()

    switch (platform) {
      case 'win32':
        // Common Firefox paths on Windows
        const possiblePaths = [
          'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
          'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
          path.join(os.homedir(), 'AppData', 'Local', 'Mozilla Firefox', 'firefox.exe'),
        ]
        return possiblePaths[0]
      case 'darwin':
        return '/Applications/Firefox.app/Contents/MacOS/firefox'
      case 'linux':
        return 'firefox'
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  /**
   * Parse profiles.ini to get list of Firefox profiles
   */
  async listProfiles(): Promise<FirefoxProfile[]> {
    try {
      const profilesDir = this.getProfilesDirectory()
      const profilesIniPath = path.join(profilesDir, 'profiles.ini')

      const profiles: FirefoxProfile[] = []

      try {
        const iniContent = await fs.readFile(profilesIniPath, 'utf-8')
        const lines = iniContent.split('\n')

        let currentSection: any = {}
        let sections: any[] = []

        for (const line of lines) {
          const trimmed = line.trim()
          
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            // New section
            if (Object.keys(currentSection).length > 0) {
              sections.push(currentSection)
            }
            currentSection = { section: trimmed }
          } else if (trimmed.includes('=')) {
            const [key, value] = trimmed.split('=').map((s) => s.trim())
            currentSection[key] = value
          }
        }

        // Add last section
        if (Object.keys(currentSection).length > 0) {
          sections.push(currentSection)
        }

        // Process sections
        for (const section of sections) {
          if (section.Path && (section.IsRelative === '1' || section.IsRelative === '0')) {
            const profilePath =
              section.IsRelative === '1'
                ? path.join(profilesDir, section.Path)
                : section.Path

            // Verify profile exists
            try {
              await fs.access(profilePath)

              profiles.push({
                id: section.Path.replace(/[^a-zA-Z0-9]/g, '_'),
                name: section.Name || section.Path,
                path: profilePath,
              })
            } catch {
              // Profile path doesn't exist, skip
            }
          }
        }
      } catch (error) {
        // profiles.ini might not exist or be unreadable
        console.warn('Could not read profiles.ini, listing profiles from directory structure')
        
        // Fallback: list directories in profiles folder
        try {
          const entries = await fs.readdir(profilesDir, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.includes('.')) {
              // Firefox profile folders typically have format like: xxxxxxxx.default-release
              const profilePath = path.join(profilesDir, entry.name)
              try {
                // Check if it's a valid profile (has prefs.js)
                await fs.access(path.join(profilePath, 'prefs.js'))
                
                profiles.push({
                  id: entry.name,
                  name: entry.name.split('.')[1] || entry.name,
                  path: profilePath,
                })
              } catch {
                // Not a valid profile
              }
            }
          }
        } catch (dirError) {
          console.error('Error listing Firefox profiles from directory:', dirError)
        }
      }

      return profiles
    } catch (error) {
      console.error('Error listing Firefox profiles:', error)
      throw new Error(`Failed to list Firefox profiles: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Create a new Firefox profile using Firefox Profile Manager
   */
  async createProfile(name: string, options?: { proxy?: string }): Promise<FirefoxProfileInfo> {
    try {
      const firefoxExecutable = this.getFirefoxExecutablePath()
      const profilesDir = this.getProfilesDirectory()

      // Use Firefox's -CreateProfile command
      // Use spawn to avoid issues with quotes and spaces
      const { spawn } = await import('child_process')
      const firefoxProcess = spawn(firefoxExecutable, ['-CreateProfile', name], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })

      // Wait a bit for Firefox to process the command
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Try to close Firefox if it opened
      try {
        if (firefoxProcess.pid) {
          // Kill the Firefox process that was just spawned
          const platform = os.platform()
          if (platform === 'win32') {
            await execAsync(`taskkill /PID ${firefoxProcess.pid} /F`)
          } else {
            await execAsync(`kill ${firefoxProcess.pid}`)
          }
        }
      } catch (error) {
        // Process might have already closed, that's fine
      }

      // Wait a bit for profile to be created
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Find the newly created profile
      const profiles = await this.listProfiles()
      const newProfile = profiles.find((p) => p.name === name || p.name.includes(name))

      if (!newProfile) {
        throw new Error('Failed to find newly created Firefox profile')
      }

      // Configure proxy in prefs.js if provided
      if (options?.proxy) {
        await this.setProxy(newProfile.path, options.proxy)
      }

      return {
        name,
        profilePath: newProfile.path,
        executablePath: firefoxExecutable,
      }
    } catch (error) {
      console.error('Error creating Firefox profile:', error)
      throw new Error(`Failed to create Firefox profile: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Set proxy settings for a Firefox profile
   */
  private async setProxy(profilePath: string, proxy: string): Promise<void> {
    try {
      const prefsJsPath = path.join(profilePath, 'prefs.js')
      
      // Parse proxy string
      const proxyConfig = this.parseProxyString(proxy)
      const [host, port] = proxyConfig.server.split(':')

      // Read existing prefs.js
      let prefsContent = ''
      try {
        prefsContent = await fs.readFile(prefsJsPath, 'utf-8')
      } catch {
        // File doesn't exist yet, will create
      }

      // Parse existing preferences (simple regex-based parsing)
      const prefs: Record<string, string> = {}
      const lines = prefsContent.split('\n')
      
      for (const line of lines) {
        const match = line.match(/user_pref\("([^"]+)",\s*"([^"]+)"\)/)
        if (match) {
          prefs[match[1]] = match[2]
        }
      }

      // Set proxy preferences
      prefs['network.proxy.type'] = '1' // Manual proxy configuration
      prefs['network.proxy.http'] = host
      prefs['network.proxy.http_port'] = port
      prefs['network.proxy.ssl'] = host
      prefs['network.proxy.ssl_port'] = port
      prefs['network.proxy.share_proxy_settings'] = 'true'

      if (proxyConfig.username && proxyConfig.password) {
        prefs['network.proxy.authentication'] = 'true'
        // Note: Firefox stores proxy auth separately, this is basic setup
      }

      // Write prefs.js
      const newPrefsContent = Object.entries(prefs)
        .map(([key, value]) => `user_pref("${key}", "${value}");`)
        .join('\n')

      await fs.writeFile(prefsJsPath, newPrefsContent)
    } catch (error) {
      console.error('Error setting Firefox proxy:', error)
      // Don't throw, proxy setting is optional
    }
  }

  /**
   * Start Firefox with a specific profile and remote debugging
   */
  async startProfile(
    profilePath: string,
    options?: {
      executablePath?: string
      proxy?: string
      remoteDebuggingPort?: number
    }
  ): Promise<{ host: string; port: number; pid: number }> {
    try {
      const firefoxExecutable = options?.executablePath || this.getFirefoxExecutablePath()
      const remotePort = options?.remoteDebuggingPort || 9222

      // Build Firefox command arguments (without quotes, spawn handles it)
      // Note: -no-remote allows multiple Firefox instances
      const args: string[] = [
        '-profile',
        profilePath, // No quotes needed, spawn handles spaces
        '-start-debugger-server',
        remotePort.toString(),
        '-no-remote', // Allow multiple instances
        '-new-instance', // Create new instance
      ]

      // Proxy is already set in prefs.js, but we can also pass it here if needed
      // Firefox doesn't support proxy via command line, must use prefs.js

      // Use spawn instead of exec for better Windows support with spaces in paths
      const { spawn } = await import('child_process')
      const firefoxProcess = spawn(firefoxExecutable, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })

      // Unref to allow parent process to exit independently
      firefoxProcess.unref()

      // Get PID
      const pid = firefoxProcess.pid || 0

      // Wait a bit for Firefox to start
      await new Promise((resolve) => setTimeout(resolve, 3000))

      return {
        host: '127.0.0.1',
        port: remotePort,
        pid: pid || 0,
      }
    } catch (error) {
      console.error('Error starting Firefox profile:', error)
      throw new Error(`Failed to start Firefox profile: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Stop Firefox process by PID (Windows) or process name (Unix)
   * Also kills all Firefox processes if needed
   * If pid is 0, kills all Firefox processes
   */
  async stopProfile(pid: number): Promise<boolean> {
    try {
      const platform = os.platform()

      if (platform === 'win32') {
        // First, try to gracefully close Firefox by PID (if PID > 0)
        if (pid > 0) {
          try {
            await execAsync(`taskkill /PID ${pid} /F`)
            // Wait a bit for process to terminate
            await new Promise((resolve) => setTimeout(resolve, 500))
          } catch (error) {
            // PID might not exist, continue to kill all Firefox processes
            console.warn(`Could not kill Firefox PID ${pid}, will try to kill all Firefox processes`)
          }
        }

        // Always kill all Firefox processes to ensure clean shutdown
        // This handles cases where Firefox is not responding or has multiple processes
        try {
          await execAsync(`taskkill /IM firefox.exe /F /T`)
          // /T kills child processes too
          // Wait a bit to ensure all processes are terminated
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error: any) {
          // No Firefox processes running, that's fine
          if (error?.code !== 128) { // 128 = no processes found
            console.log('No Firefox processes found to kill (expected if already closed)')
          }
        }
      } else {
        // Unix/Linux: try graceful kill first, then force kill
        if (pid > 0) {
          try {
            await execAsync(`kill ${pid}`)
            // Wait a bit for graceful shutdown
            await new Promise((resolve) => setTimeout(resolve, 2000))
          } catch (error) {
            // Process might already be stopped
          }

          // Force kill if still running
          try {
            await execAsync(`kill -9 ${pid}`)
          } catch (error) {
            // Process already stopped
          }
        }

        // Also kill all firefox processes
        try {
          await execAsync(`pkill -9 firefox`)
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
          // No Firefox processes
        }
      }

      return true
    } catch (error) {
      console.error('Error stopping Firefox profile:', error)
      // Process might already be stopped, return true
      return true
    }
  }

  /**
   * Parse proxy string to extract server, username, password
   */
  private parseProxyString(proxy: string): { server: string; username?: string; password?: string } {
    // Format: http://host:port or http://user:pass@host:port or host:port
    const urlMatch = proxy.match(/^(https?:\/\/)?(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/)
    
    if (urlMatch) {
      return {
        server: `${urlMatch[4]}:${urlMatch[5]}`,
        username: urlMatch[2],
        password: urlMatch[3],
      }
    }

    // Fallback: assume format is host:port
    return { server: proxy }
  }
}

