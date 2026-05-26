import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)

export interface ChromeProfile {
  id: string
  name: string
  path: string
}

export interface ChromeProfileInfo {
  name: string
  profilePath: string
  executablePath?: string
}

export class ChromeProfileAdapter {
  /**
   * Get Chrome User Data Directory path based on OS
   */
  private getUserDataDirectory(): string {
    const platform = os.platform()
    const homeDir = os.homedir()

    switch (platform) {
      case 'win32':
        return path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome')
      case 'linux':
        return path.join(homeDir, '.config', 'google-chrome')
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  /**
   * Get Chrome executable path based on OS
   * Returns the first path that exists, or the default if none exist
   */
  private async getChromeExecutablePath(): Promise<string> {
    const platform = os.platform()

    switch (platform) {
      case 'win32': {
        // Common Chrome paths on Windows - reordered to prioritize x86 as requested
        const possiblePaths = [
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        ]

        // Try to find an existing Chrome executable
        for (const chromePath of possiblePaths) {
          try {
            await fs.access(chromePath)
            return chromePath // Return first path that exists
          } catch {
            // Path doesn't exist, try next
            continue
          }
        }

        // If none found, return the most likely one but warn
        console.warn('[Chrome] Chrome executable not found in common paths')
        return possiblePaths[0]
      }
      case 'darwin': {
        const defaultPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        try {
          await fs.access(defaultPath)
          return defaultPath
        } catch {
          throw new Error(`Chrome executable not found at ${defaultPath}`)
        }
      }
      case 'linux':
        return 'google-chrome' // Let the shell find it
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  /**
   * List all Chrome profiles from User Data Directory
   */
  async listProfiles(): Promise<ChromeProfile[]> {
    try {
      const userDataDir = this.getUserDataDirectory()
      const profiles: ChromeProfile[] = []

      // Read Local State to get profile info
      const localStatePath = path.join(userDataDir, 'Local State')
      let profileInfo: any = {}

      try {
        const localStateContent = await fs.readFile(localStatePath, 'utf-8')
        profileInfo = JSON.parse(localStateContent)
      } catch (error) {
        console.warn('Could not read Local State, listing profiles from directory structure')
      }

      // List directories in User Data
      const entries = await fs.readdir(userDataDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const profileName = entry.name

          // Skip system directories
          if (['Default', 'System Profile'].includes(profileName) || profileName.startsWith('Profile ')) {
            const profilePath = path.join(userDataDir, profileName)
            const preferencesPath = path.join(profilePath, 'Preferences')

            // Check if it's a valid profile (has Preferences file)
            try {
              await fs.access(preferencesPath)

              // Get profile name from Preferences or Local State
              let displayName = profileName
              try {
                const prefsContent = await fs.readFile(preferencesPath, 'utf-8')
                const prefs = JSON.parse(prefsContent)
                displayName = prefs.profile?.name || prefs.account_info?.[0]?.given_name || profileName
              } catch {
                // Use profile name from Local State if available
                const profileData = profileInfo.profile?.info_cache?.[profileName]
                if (profileData?.name) {
                  displayName = profileData.name
                }
              }

              profiles.push({
                id: profileName,
                name: displayName,
                path: profilePath,
              })
            } catch {
              // Not a valid profile, skip
            }
          }
        }
      }

      return profiles
    } catch (error) {
      console.error('Error listing Chrome profiles:', error)
      throw new Error(`Failed to list Chrome profiles: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Create a new Chrome profile
   */
  async createProfile(name: string, options?: { proxy?: string }): Promise<ChromeProfileInfo> {
    try {
      const userDataDir = this.getUserDataDirectory()

      // Generate unique profile folder name with name prefix for easier identification
      // Use sanitized name to avoid filesystem issues
      const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
      const timestamp = Date.now()
      const profileFolderName = `${sanitizedName}_${timestamp}`
      const profilePath = path.join(userDataDir, profileFolderName)

      // Check if profile directory already exists
      try {
        await fs.access(profilePath)
        // Directory exists, this might be a conflict
        // In Chrome, using same user-data-dir while another instance is running causes issues
        // But since we're using unique timestamp, this should rarely happen
        console.warn(`[Chrome] Profile directory already exists: ${profilePath}`)
      } catch {
        // Directory doesn't exist, create it
        await fs.mkdir(profilePath, { recursive: true })
      }

      // Create default Preferences file
      const preferences: any = {
        profile: {
          name: name,
          created_by_version: '1.0',
        },
        account_info: [],
      }

      // Set proxy if provided
      if (options?.proxy) {
        const proxyConfig = this.parseProxyString(options.proxy)
        preferences.proxy = {
          mode: 'fixed_servers',
          server: proxyConfig.server,
        }
        if (proxyConfig.username && proxyConfig.password) {
          // Note: Chrome stores proxy auth in separate file, this is basic setup
          preferences.proxy_auth_config = {
            username: proxyConfig.username,
            password: proxyConfig.password,
          }
        }
      }

      const preferencesPath = path.join(profilePath, 'Preferences')
      await fs.writeFile(preferencesPath, JSON.stringify(preferences, null, 2))

      // Create First Run file (indicates profile is initialized)
      const firstRunPath = path.join(profilePath, 'First Run')
      await fs.writeFile(firstRunPath, '')

      return {
        name,
        profilePath,
        executablePath: await this.getChromeExecutablePath(),
      }
    } catch (error) {
      console.error('Error creating Chrome profile:', error)
      throw new Error(`Failed to create Chrome profile: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Start Chrome with a specific profile and remote debugging
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
      // Get Chrome executable path (check if it exists if not provided)
      let chromeExecutable = options?.executablePath
      if (!chromeExecutable) {
        chromeExecutable = await this.getChromeExecutablePath()
      }

      // Verify Chrome executable exists before trying to spawn
      try {
        await fs.access(chromeExecutable)
      } catch (error) {
        throw new Error(`Chrome executable not found at: ${chromeExecutable}. Please specify the correct path in the profile settings.`)
      }

      const remotePort = options?.remoteDebuggingPort || 9222

      // Build Chrome command arguments
      // Important: Each Chrome instance needs isolated flags to avoid conflicts
      const args: string[] = [
        `--user-data-dir=${profilePath}`,
        `--remote-debugging-port=${remotePort}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        // Isolation flags to prevent conflicts with other Chrome instances
        '--disable-background-networking', // Prevent background sync conflicts
        '--disable-background-timer-throttling',
        '--disable-breakpad', // Disable crash reporting
        '--disable-component-extensions-with-background-pages',
        '--disable-extensions-http-throttling',
        '--disable-sync', // Disable Chrome sync to avoid conflicts
        '--disable-translate',
        '--disable-web-resources', // Prevent background resource loading
        '--metrics-recording-only', // Disable metrics to avoid conflicts
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic', // Use basic password store to avoid conflicts
        '--use-mock-keychain', // On macOS, use mock keychain
        // Allow multiple instances with different user data dirs
        '--disable-features=TranslateUI',
      ]

      // Add proxy if provided
      if (options?.proxy) {
        const proxyConfig = this.parseProxyString(options.proxy)
        args.push(`--proxy-server=${proxyConfig.server}`)
        // Note: Chrome proxy auth requires separate handling
      }

      // Check if another Chrome instance is using this profile directory
      // Chrome locks the profile directory, so we can check for lock files
      const lockFile = path.join(profilePath, 'SingletonLock')
      const lockSocket = path.join(profilePath, 'SingletonSocket')
      const singletonCookie = path.join(profilePath, 'SingletonCookie')

      // Try to remove lock files if they exist (indicating previous instance didn't close properly)
      try {
        await fs.access(lockFile)
        console.warn(`[Chrome] Found lock file, previous instance may not have closed properly: ${lockFile}`)
        try {
          await fs.unlink(lockFile).catch(() => { })
          await fs.unlink(lockSocket).catch(() => { })
          await fs.unlink(singletonCookie).catch(() => { })
        } catch {
          // Lock files may be in use, that's okay - Chrome will handle it
        }
      } catch {
        // No lock files, profile directory is free
      }

      const platform = os.platform()

      // Use spawn instead of exec for better Windows support with spaces in paths
      const { spawn } = await import('child_process')

      console.log(`[Chrome] Attempting to spawn Chrome with executable: ${chromeExecutable}`)
      console.log(`[Chrome] Profile path: ${profilePath}`)
      console.log(`[Chrome] Remote debugging port: ${remotePort}`)

      const chromeProcess = spawn(chromeExecutable, args, {
        detached: false, // Keep attached initially to ensure process starts
        stdio: 'ignore',
        windowsHide: true,
      })

      // Listen for process errors BEFORE checking PID
      let spawnError: Error | null = null
      chromeProcess.on('error', (error) => {
        console.error('[Chrome] Chrome process spawn error:', error)
        spawnError = error
      })

      // Get PID immediately before detaching
      const initialPid = chromeProcess.pid || 0

      // Wait a bit to see if error event fires
      await new Promise((resolve) => setTimeout(resolve, 100))

      if (spawnError) {
        const errorMsg = (spawnError as any).message || String(spawnError)
        throw new Error(`Failed to spawn Chrome process: ${errorMsg}. Executable: ${chromeExecutable}`)
      }

      if (initialPid === 0) {
        throw new Error(`Failed to spawn Chrome process: PID is 0. Chrome executable may not be found or accessible at: ${chromeExecutable}. Please check the executable path.`)
      }

      console.log(`[Chrome] Spawned Chrome process with PID ${initialPid}, profile: ${profilePath}`)

      // Wait a bit for Chrome to start (don't unref immediately)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Note: Chrome parent process may exit after spawning child processes
      // This is normal behavior, so we don't check if parent process is still running
      // Instead, we'll verify by checking if remote debugging port is listening

      // Now detach so Chrome runs independently
      chromeProcess.unref()

      // Wait more for Chrome to bind to remote debugging port
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Try to find Chrome process by remote-debugging-port (more reliable than PID)
      let finalPid = initialPid
      if (platform === 'win32') {
        try {
          // Use netstat to find process listening on remote-debugging-port
          const { exec } = await import('child_process')
          const { promisify } = await import('util')
          const execAsync = promisify(exec)

          // Try netstat first (most reliable)
          const netstatResult = await execAsync(`netstat -ano | findstr ":${remotePort}"`, { timeout: 5000 })
          // netstat output format: TCP    0.0.0.0:9262           0.0.0.0:0              LISTENING       12345
          // Try multiple patterns to match netstat output
          let pidMatch = netstatResult.stdout.match(/:${remotePort}\s+\S+\s+\S+\s+\S+\s+(\d+)/)
          if (!pidMatch) {
            // Try alternative pattern for different netstat output formats
            pidMatch = netstatResult.stdout.match(/:${remotePort}[^\d]*(\d+)/)
          }
          if (!pidMatch && netstatResult.stdout.includes(remotePort.toString())) {
            // Last resort: extract all numbers and try to find PID (usually last number in line)
            const lines = netstatResult.stdout.split('\n')
            for (const line of lines) {
              if (line.includes(remotePort.toString()) && line.includes('LISTENING')) {
                const numbers = line.match(/\d+/g)
                if (numbers && numbers.length > 0) {
                  // Last number is usually the PID
                  const potentialPid = parseInt(numbers[numbers.length - 1], 10)
                  if (potentialPid > 100) { // PIDs are usually > 100
                    pidMatch = [null, potentialPid.toString()] as any
                    break
                  }
                }
              }
            }
          }
          if (pidMatch && pidMatch[1]) {
            finalPid = parseInt(pidMatch[1], 10)
            console.log(`[Chrome] Found Chrome process PID ${finalPid} by remote-debugging-port ${remotePort}`)
          } else {
            console.warn(`[Chrome] Could not find PID by port ${remotePort} in netstat output:`, netstatResult.stdout)
            // Fallback: try to find by user-data-dir using wmic
            try {
              // Escape single quotes and backslashes for wmic
              const escapedPath = profilePath.replace(/\\/g, '\\\\').replace(/'/g, "''")
              const wmicQuery = `wmic process where "commandline like '%${escapedPath}%' and name='chrome.exe'" get processid,commandline /format:csv`
              const wmicResult = await execAsync(wmicQuery, { timeout: 5000 })
              // CSV format: Node,ProcessId,CommandLine
              const lines = wmicResult.stdout.split('\n').filter(line => line.trim() && !line.includes('Node,'))
              for (const line of lines) {
                const parts = line.split(',')
                if (parts.length >= 3 && parts[1] && parts[2] && parts[2].includes(profilePath)) {
                  const pid = parseInt(parts[1], 10)
                  if (pid > 0) {
                    finalPid = pid
                    console.log(`[Chrome] Found Chrome process PID ${finalPid} by user-data-dir`)
                    break
                  }
                }
              }
            } catch (error) {
              console.warn('[Chrome] Could not find Chrome process by user-data-dir:', error)
            }
          }

          // If still no PID found, log warning but don't fail
          if (finalPid === 0) {
            console.warn(`[Chrome] Warning: Could not determine Chrome process PID for port ${remotePort}. Chrome may be running but PID tracking will not work.`)
            // Use initial PID as fallback (even if 0, the port check below will verify Chrome is running)
            finalPid = initialPid
          }
        } catch (error) {
          console.warn(`[Chrome] Error finding Chrome process PID by port ${remotePort}:`, error)
          // Use initial PID as fallback
          finalPid = initialPid
        }
      }

      // Verify that Chrome is actually listening on the remote debugging port
      try {
        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)

        const verifyResult = await execAsync(`netstat -ano | findstr ":${remotePort}"`, { timeout: 3000 })
        if (!verifyResult.stdout || !verifyResult.stdout.includes(remotePort.toString())) {
          throw new Error(`Chrome is not listening on remote debugging port ${remotePort}. Chrome may have failed to start.`)
        }
        console.log(`[Chrome] Verified Chrome is listening on port ${remotePort}`)
      } catch (error: any) {
        // If netstat fails, Chrome might not have started properly
        if (error.message && error.message.includes('Chrome is not listening')) {
          throw error
        }
        console.warn(`[Chrome] Could not verify Chrome is listening on port ${remotePort}:`, error.message)
        // Don't throw - Chrome might be starting, let the caller handle it
      }

      return {
        host: '127.0.0.1',
        port: remotePort,
        pid: finalPid || initialPid || 0,
      }
    } catch (error) {
      console.error('Error starting Chrome profile:', error)
      throw new Error(`Failed to start Chrome profile: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Stop Chrome process by PID (Windows) or process name (Unix)
   * Also accepts remoteDebuggingPort and profilePath as optional parameters for fallback
   */
  async stopProfile(pid: number, profilePath?: string, remoteDebuggingPort?: number): Promise<boolean> {
    try {
      const platform = os.platform()

      if (platform === 'win32') {
        // If PID is valid, try to kill by PID first
        if (pid > 0) {
          try {
            await execAsync(`taskkill /PID ${pid} /F /T`)
            // Wait a bit for process to terminate
            await new Promise((resolve) => setTimeout(resolve, 1000))
            // Check if process is still running
            try {
              await execAsync(`tasklist /FI "PID eq ${pid}"`)
              // If tasklist succeeds, process still exists, continue with fallback
            } catch (error) {
              // Process is killed, return success
              return true
            }
          } catch (error) {
            // PID might not exist, continue to fallback methods
            console.warn(`Could not kill Chrome PID ${pid}, trying fallback methods`)
          }
        }

        // Fallback 1: Try to find and kill by remote-debugging-port
        if (remoteDebuggingPort) {
          try {
            const netstatResult = await execAsync(`netstat -ano | findstr ":${remoteDebuggingPort}"`, { timeout: 5000 })
            const pidMatches = netstatResult.stdout.match(/:${remoteDebuggingPort}\s+\S+\s+\S+\s+\S+\s+(\d+)/g)
            if (pidMatches) {
              const pids = new Set<number>()
              for (const match of pidMatches) {
                const foundPid = parseInt(match.split(/\s+/).pop() || '0', 10)
                if (foundPid > 0) {
                  pids.add(foundPid)
                }
              }

              // Kill all processes found
              for (const foundPid of pids) {
                try {
                  await execAsync(`taskkill /PID ${foundPid} /F /T`)
                } catch (error) {
                  // Process might already be stopped
                }
              }
              await new Promise((resolve) => setTimeout(resolve, 1000))
              return true
            }
          } catch (error) {
            console.warn(`Could not find Chrome process by port ${remoteDebuggingPort}`)
          }
        }

        // Fallback 2: Try to kill by user-data-dir
        if (profilePath) {
          try {
            const escapedPath = profilePath.replace(/\\/g, '\\\\')
            const wmicQuery = `wmic process where "commandline like '%${escapedPath}%' and name='chrome.exe'" get processid /format:value`
            const wmicResult = await execAsync(wmicQuery, { timeout: 5000 })
            const pidMatches = wmicResult.stdout.match(/ProcessId=(\d+)/g)

            if (pidMatches) {
              // Kill all matching processes
              for (const match of pidMatches) {
                const foundPid = parseInt(match.split('=')[1], 10)
                try {
                  await execAsync(`taskkill /PID ${foundPid} /F /T`)
                } catch (error) {
                  // Process might already be stopped
                }
              }
              await new Promise((resolve) => setTimeout(resolve, 1000))
              return true
            }
          } catch (error) {
            console.warn('Could not kill Chrome by profile path')
          }
        }
      } else {
        // Unix/Linux
        if (pid > 0) {
          try {
            await execAsync(`kill ${pid}`)
            await new Promise((resolve) => setTimeout(resolve, 2000))
          } catch (error) {
            // Process might already be stopped
          }
          try {
            await execAsync(`kill -9 ${pid}`)
          } catch (error) {
            // Process already stopped
          }
        }

        // Fallback: kill by profile path
        if (pid === 0 && profilePath) {
          try {
            await execAsync(`pkill -f "chrome.*--user-data-dir=${profilePath}"`)
            await new Promise((resolve) => setTimeout(resolve, 1000))
          } catch (error) {
            // No processes found
          }
        }
      }

      return true
    } catch (error) {
      console.error('Error stopping Chrome profile:', error)
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

