/**
 * GpmLoginAdapter - Interface for GPMLogin API integration
 * 
 * Implements AUTOMATION_LAYER_SPEC.md interface
 * GPMLogin API Documentation: https://docs.gpmloginapp.com/api-document
 * Default API URL: http://127.0.0.1:19995
 */

// Spec-compliant interfaces
export interface GpmProfileInfo {
  id: string         // profileUid
  name: string
  proxy?: string
  status?: string    // optional: running, stopped, ...
}

export interface GpmStartProfileResult {
  profileUid: string
  success: boolean
  message?: string
  remoteDebuggingPort?: number
  remoteDebuggingHost?: string // default 127.0.0.1
}

export interface GpmStopProfileResult {
  profileUid: string
  success: boolean
  message?: string
}

// Legacy interfaces (for backward compatibility)
// According to GPMLogin API docs: https://docs.gpmloginapp.com/api-document/danh-sach-profiles
export interface GpmProfile {
  id: string
  name: string
  raw_proxy?: string
  proxy?: string // Alias for raw_proxy (backward compatibility)
  group_id?: string | number
  browser_type?: string // 'chromium' | 'firefox'
  browser_version?: string
  profile_path?: string // Local path or S3
  note?: string
  created_at?: string
  updated_at?: string
  [key: string]: any
}

export interface StartProfileResult {
  success: boolean
  remoteDebuggingPort?: number
  error?: string
  data?: any
}

export interface GpmApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
}

/** Chuẩn hóa URL (bỏ dấu ngoặc từ .env, slash cuối) */
export function normalizeGpmApiUrl(url: string): string {
  return url.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '')
}

/** Tính base URL gọi API từ host + version */
export function buildGpmBaseUrl(apiUrl: string, apiVersion: string): string {
  const host = normalizeGpmApiUrl(apiUrl)
  if (host.toLowerCase().includes('/api/')) {
    return host
  }
  if (apiVersion === '') {
    return `${host}/api`
  }
  return `${host}/api/${apiVersion}`
}

export type GpmConnectionTestResult = {
  ok: boolean
  message: string
  apiUrl: string
  baseUrl: string
  testUrl: string
  httpStatus?: number
}

export class GpmLoginAdapter {
  private apiUrl: string
  private apiVersion: string
  private baseUrl: string

  constructor(apiUrl?: string, apiVersion?: string) {
    const envUrl = process.env.GPMLOGIN_API_URL || process.env.GPM_API_BASE_URL
    const rawUrl = normalizeGpmApiUrl(apiUrl || envUrl || 'http://127.0.0.1:19995')
    this.apiUrl = rawUrl
    this.apiVersion =
      apiVersion !== undefined
        ? apiVersion
        : (process.env.GPMLOGIN_API_VERSION || 'v3').replace(/^["']|["']$/g, '')
    this.baseUrl = buildGpmBaseUrl(this.apiUrl, this.apiVersion)
  }

  /**
   * Kiểm tra kết nối tới GPMLogin API (dùng trước khi start profile)
   */
  async testConnection(): Promise<GpmConnectionTestResult> {
    const testUrl = `${this.baseUrl}/profiles?page=1&per_page=1`
    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      })

      const bodyPreview = (await response.text()).substring(0, 200)

      if (response.ok) {
        return {
          ok: true,
          message: 'Kết nối GPMLogin API thành công',
          apiUrl: this.apiUrl,
          baseUrl: this.baseUrl,
          testUrl,
          httpStatus: response.status,
        }
      }

      let hint = `API trả HTTP ${response.status}.`
      try {
        const rootRes = await fetch(this.apiUrl, { signal: AbortSignal.timeout(3000) })
        const rootText = await rootRes.text()
        if (rootRes.ok && /gpm/i.test(rootText)) {
          hint =
            `Cổng ${this.apiUrl} có phản hồi GPM nhưng đường dẫn API sai. Thử API Version v3 hoặc URL đầy đủ (vd. ${this.apiUrl}/api/v3).`
        }
      } catch {
        // ignore root probe
      }

      return {
        ok: false,
        message: `${hint} Phản hồi: ${bodyPreview}`,
        apiUrl: this.apiUrl,
        baseUrl: this.baseUrl,
        testUrl,
        httpStatus: response.status,
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const refused =
        msg.includes('fetch failed') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ECONNRESET')

      let port = ''
      try {
        port = new URL(this.apiUrl).port || '80'
      } catch {
        port = '?'
      }

      return {
        ok: false,
        message: refused
          ? `Không kết nối được cổng ${port} tại ${this.apiUrl}. Mở ứng dụng GPMLogin, bật API Local và đối chiếu đúng cổng trong Cài đặt GPM (hiện cấu hình: ${this.apiUrl}).`
          : `Lỗi kết nối: ${msg}`,
        apiUrl: this.apiUrl,
        baseUrl: this.baseUrl,
        testUrl,
      }
    }
  }

  getApiUrl(): string {
    return this.apiUrl
  }

  getApiVersion(): string {
    return this.apiVersion
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  /**
   * List profiles - Spec-compliant method
   * Returns GpmProfileInfo[] as per AUTOMATION_LAYER_SPEC.md
   */
  async listProfiles(): Promise<GpmProfileInfo[]> {
    try {
      const { profiles } = await this.getProfiles(1, 1000)
      return profiles.map((p) => ({
        id: p.id,
        name: p.name,
        proxy: p.raw_proxy || p.proxy, // Use raw_proxy if available (per API docs), fallback to proxy
        status: undefined, // GPMLogin API may not return status in list
      }))
    } catch (error) {
      console.error('Error listing GPMLogin profiles:', error)
      return []
    }
  }

  /**
   * Start profile - Spec-compliant method
   * Returns GpmStartProfileResult as per AUTOMATION_LAYER_SPEC.md
   */
  async startProfile(profileUid: string): Promise<GpmStartProfileResult> {
    try {
      const result = await this.startProfileLegacy(profileUid)
      
      if (result.success && result.remoteDebuggingPort) {
        return {
          profileUid,
          success: true,
          remoteDebuggingPort: result.remoteDebuggingPort,
          remoteDebuggingHost: '127.0.0.1', // GPMLogin runs locally
        }
      }

      return {
        profileUid,
        success: false,
        message: result.error || 'Failed to start profile',
      }
    } catch (error) {
      return {
        profileUid,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Stop profile - Spec-compliant method
   * Returns GpmStopProfileResult as per AUTOMATION_LAYER_SPEC.md
   */
  async stopProfile(profileUid: string): Promise<GpmStopProfileResult> {
    try {
      const success = await this.stopProfileLegacy(profileUid)
      
      return {
        profileUid,
        success,
        message: success ? 'Profile stopped successfully' : 'Failed to stop profile',
      }
    } catch (error) {
      return {
        profileUid,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get all profiles from GPMLogin
   * GET /api/v3/profiles
   * According to GPMLogin API docs: https://docs.gpmloginapp.com/api-document/danh-sach-profiles
   * 
   * Params:
   * - group_id: ID group cần lọc (optional)
   * - page: Số trang (default: 1)
   * - per_page: Số profile mỗi trang (default: 50)
   * - sort: 0 - Mới nhất, 1 - Cũ tới mới, 2 - Tên A-Z, 3 - Tên Z-A (optional)
   * - search: Từ khóa profile name (optional)
   */
  async getProfiles(
    page: number = 1,
    perPage: number = 100,
    search?: string,
    groupId?: string | number,
    sort?: number
  ): Promise<{ profiles: GpmProfile[]; total: number; pagination?: any }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      })

      if (search) params.append('search', search)
      if (groupId) {
        // Support both string and number groupId
        params.append('group_id', groupId.toString())
      }
      if (sort !== undefined) {
        params.append('sort', sort.toString())
      }

      const response = await fetch(`${this.baseUrl}/profiles?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000), // 10s timeout
      })

      if (!response.ok) {
        throw new Error(`GPMLogin API error: ${response.status} ${response.statusText}`)
      }

      // Parse JSON regardless of content-type header (GPMLogin Global returns unknown)
      const responseText = await response.text()
      let data: any
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        console.error('GPMLogin API returned non-JSON response:', responseText.substring(0, 500))
        throw new Error(`GPMLogin API returned non-JSON response. Status: ${response.status}`)
      }

      if (data.success && data.data) {
        // Handle nested structure in Global v1 API: data.data.data
        const profilesList = Array.isArray(data.data) 
          ? data.data 
          : (data.data.data && Array.isArray(data.data.data) ? data.data.data : [])

        return {
          profiles: profilesList,
          total: data.pagination?.total || data.data.total || profilesList.length || 0,
          pagination: data.pagination || (data.data.current_page ? data.data : undefined),
        }
      }

      return { profiles: [], total: 0 }
    } catch (error) {
      console.error('Error fetching GPMLogin profiles:', error)
      throw error
    }
  }

  /**
   * Get profile info by ID
   * GET /api/v3/profiles/{id}
   */
  async getProfileInfo(profileId: string): Promise<GpmProfile | null> {
    try {
      const response = await fetch(`${this.baseUrl}/profiles/${profileId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`GPMLogin API error: ${response.status} ${response.statusText}`)
      }

      const responseText = await response.text()
      let data: GpmApiResponse<GpmProfile>
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        throw new Error(`GPMLogin API returned non-JSON response. Status: ${response.status}`)
      }

      if (data.success && data.data) {
        return data.data
      }

      return null
    } catch (error) {
      console.error(`Error fetching GPMLogin profile ${profileId}:`, error)
      throw error
    }
  }

  /**
   * Start profile (open browser) - Legacy method
   * GET /api/v3/profiles/start/{id}
   * Returns remote debugging port for BrowserController to connect
   */
  private async startProfileLegacy(profileId: string): Promise<StartProfileResult> {
    try {
      const response = await fetch(`${this.baseUrl}/profiles/start/${profileId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000), // 30s timeout for starting
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`GPMLogin API error ${response.status}:`, errorText)
        return {
          success: false,
          error: `GPMLogin API error: ${response.status} ${errorText}`,
        }
      }

      const responseText = await response.text()
      let data: GpmApiResponse<any>
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        throw new Error(`GPMLogin API returned non-JSON response. Status: ${response.status}`)
      }
      
      console.log(`GPMLogin start profile response:`, JSON.stringify(data, null, 2))

      if (!data.success) {
        console.error(`GPMLogin failed to start profile ${profileId}:`, data.message || 'Unknown error')
        return {
          success: false,
          error: data.message || 'Failed to start profile',
        }
      }

      if (data.success) {
        // GPMLogin API may return data in different formats
        // Format 1: data.data.remote_debugging_port
        // Format 2: data.data.remote_debugging_address (e.g., "127.0.0.1:9222")
        // Format 3: data.data is the profile info directly
        let remoteDebuggingPort: number | undefined = undefined

        if (data.data) {
          // Try to extract port from various possible formats
          if (typeof data.data.remote_debugging_port === 'number') {
            remoteDebuggingPort = data.data.remote_debugging_port
          } else if (typeof data.data.remote_debugging_port === 'string') {
            remoteDebuggingPort = parseInt(data.data.remote_debugging_port, 10)
          } else if (typeof data.data.remote_debugging_address === 'string') {
            // Parse "127.0.0.1:9222" format (Global v1)
            const match = data.data.remote_debugging_address.match(/:(\d+)$/)
            if (match) {
              remoteDebuggingPort = parseInt(match[1], 10)
            }
          } else if (data.data.port) {
            remoteDebuggingPort = typeof data.data.port === 'number' ? data.data.port : parseInt(String(data.data.port), 10)
          }

          // If still no port, check if data.data itself has nested structure
          if (!remoteDebuggingPort && data.data.data) {
            const nestedData = data.data.data
            if (typeof nestedData.remote_debugging_port === 'number') {
              remoteDebuggingPort = nestedData.remote_debugging_port
            } else if (typeof nestedData.remote_debugging_address === 'string') {
              const match = nestedData.remote_debugging_address.match(/:(\d+)$/)
              if (match) {
                remoteDebuggingPort = parseInt(match[1], 10)
              }
            }
          }
        }

        if (remoteDebuggingPort) {
          return {
            success: true,
            remoteDebuggingPort,
            data: data.data,
          }
        } else {
          // Profile started but no port returned - might be already running
          console.warn(`Profile ${profileId} started but no remote_debugging_port in response`)
          return {
            success: true,
            remoteDebuggingPort: undefined,
            data: data.data,
          }
        }
      }

      return {
        success: false,
        error: data.message || 'Failed to start profile',
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Error starting GPMLogin profile ${profileId} at ${this.baseUrl}:`, error)
      const refused =
        msg.includes('fetch failed') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ECONNRESET')
      return {
        success: false,
        error: refused
          ? `Không kết nối GPMLogin tại ${this.baseUrl}. Mở GPMLogin và kiểm tra API URL (vd. http://127.0.0.1:19496).`
          : msg,
      }
    }
  }

  /**
   * Stop profile (close browser) - Legacy method
   * GET /api/v3/profiles/close/{id}
   * According to GPMLogin API docs: https://docs.gpmloginapp.com/api-document/dong-profile
   */
  private async stopProfileLegacy(profileId: string): Promise<boolean> {
    try {
      // GPMLogin Global and Local both use /close/
      const endpoint = 'close'
      
      const response = await fetch(`${this.baseUrl}/profiles/${endpoint}/${profileId}`, {
        method: 'GET',
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`GPMLogin API error ${response.status} when closing profile:`, errorText)
        return false
      }

      const responseText = await response.text()
      let data: GpmApiResponse
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        throw new Error(`GPMLogin API returned non-JSON response. Status: ${response.status}`)
      }
      
      console.log(`GPMLogin close profile response:`, JSON.stringify(data, null, 2))
      
      if (data.success) {
        return true
      }
      
      console.error(`Failed to close profile: ${data.message || 'Unknown error'}`)
      return false
    } catch (error) {
      console.error(`Error stopping GPMLogin profile ${profileId}:`, error)
      return false
    }
  }

  /**
   * Create new profile
   * POST /api/v3/profiles/create
   * According to GPMLogin API docs: https://docs.gpmloginapp.com/api-document
   */
  async createProfile(data: {
    name: string
    proxy?: string
    group_id?: string | number
    browser_core?: string
    [key: string]: any
  }): Promise<GpmProfile | null> {
    try {
      // Detect if this is Global v1 API (uses different field names)
      const isGlobalV1 = this.apiVersion === 'v1'

      // Format payload according to GPMLogin API version
      const payload: any = {
        browser_core: data.browser_core || 'chromium', // chromium or firefox
      }

      // Local v3 uses 'profile_name', Global v1 uses 'name'
      if (isGlobalV1) {
        payload.name = data.name
      } else {
        payload.profile_name = data.name
      }

      if (data.proxy) {
        payload.raw_proxy = this.formatProxyForApi(data.proxy)
      }

      if (data.group_id !== undefined && data.group_id !== null) {
        // Local v3: group_id as number; Global v1: group_id as string (UUID) or number
        if (isGlobalV1) {
          payload.group_id = String(data.group_id) // Keep as string for Global UUID group IDs
        } else {
          payload.group_id = typeof data.group_id === 'number' ? data.group_id : parseInt(String(data.group_id), 10)
        }
      }

      const url = `${this.baseUrl}/profiles/create`
      console.log(`[GpmLoginAdapter.createProfile] POST ${url}`)
      console.log(`[GpmLoginAdapter.createProfile] Payload:`, JSON.stringify(payload))

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      })

      // Get response text first (can only read once)
      const responseText = await response.text()

      console.log(`[GpmLoginAdapter.createProfile] HTTP ${response.status} from ${url}`)
      console.log(`[GpmLoginAdapter.createProfile] Response:`, responseText.substring(0, 1000))

      if (!response.ok) {
        throw new Error(`GPMLogin API HTTP ${response.status}: ${responseText.substring(0, 300)}`)
      }

      // Parse JSON with error handling
      let result: GpmApiResponse<GpmProfile | GpmProfile[]>
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error('Failed to parse GPMLogin API response as JSON:', parseError)
        console.error('Response text:', responseText.substring(0, 500))
        throw new Error(`Failed to parse GPMLogin API response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. Response: ${responseText.substring(0, 200)}`)
      }

      if (result.success && result.data) {
        // API may return single object or array
        const profileData = Array.isArray(result.data) ? result.data[0] : result.data
        // Handle Global v1 nested: data.data
        if (profileData && !profileData.id && (profileData as any).data) {
          return (profileData as any).data
        }
        return profileData || null
      }

      // Global API sometimes returns success=true but data is directly the profile
      // or returns the profile at top level
      if ((result as any).id) {
        return result as unknown as GpmProfile
      }

      console.warn(`[GpmLoginAdapter.createProfile] Unexpected response format:`, JSON.stringify(result).substring(0, 500))
      return null
    } catch (error) {
      console.error('Error creating GPMLogin profile:', error)
      throw error
    }
  }

  /**
   * Update profile
   * POST /api/v3/profiles/update/{id}
   * According to GPMLogin API docs: https://docs.gpmloginapp.com/api-document/cap-nhat-profile
   */
  async updateProfile(
    profileId: string,
    data: {
      profile_name: string
      raw_proxy?: string
      proxy?: string // Alias for raw_proxy (backward compatibility)
      group_id?: number
      [key: string]: any
    }
  ): Promise<boolean> {
    try {
      const payload: any = {
        profile_name: data.profile_name,
      }

      // Handle proxy (use raw_proxy if available, fallback to proxy)
      const proxyValue = data.raw_proxy || data.proxy
      if (proxyValue !== undefined) {
        const formatted = this.formatProxyForApi(proxyValue)
        payload.raw_proxy = formatted
        payload.proxy = formatted // Send both for broad compatibility
      }

      // Handle group_id
      if (data.group_id !== undefined) {
        payload.group_id = data.group_id
      }

      // Copy other fields
      Object.keys(data).forEach((key) => {
        if (key !== 'profile_name' && key !== 'raw_proxy' && key !== 'proxy' && key !== 'group_id') {
          payload[key] = data[key]
        }
      })

      const url = `${this.baseUrl}/profiles/update/${profileId}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`GPMLogin API error ${response.status} when updating profile:`, errorText)
        return false
      }

      const responseText = await response.text()

      let result: GpmApiResponse
      try {
        result = JSON.parse(responseText)
      } catch (e) {
        throw new Error(`GPMLogin API returned non-JSON response. Status: ${response.status}`)
      }
      
      if (result.success) {
        return true
      }
      
      console.error(`Failed to update profile: ${result.message || 'Unknown error'}`)
      return false
    } catch (error) {
      console.error(`Error updating GPMLogin profile ${profileId}:`, error)
      return false
    }
  }

  /**
   * Update profile proxy
   * Uses updateProfile internally
   */
  async updateProfileProxy(profileId: string, proxy: string | null, fallbackName?: string): Promise<boolean> {
    try {
      // First get profile info to get profile_name (required)
      const profileInfo = await this.getProfileInfo(profileId)
      const finalName = profileInfo?.name || fallbackName
      
      if (!finalName) {
        console.error(`Profile ${profileId} not found and no fallback name provided`)
        return false
      }

      const updateData: any = {
        profile_name: finalName,
        raw_proxy: proxy || '', // Empty string to remove
      }

      return await this.updateProfile(profileId, updateData)
    } catch (error) {
      console.error(`Error updating proxy for profile ${profileId}:`, error)
      return false
    }
  }

  /**
   * Get list of groups
   * GET /api/v3/groups
   * According to GPMLogin API docs: https://docs.gpmloginapp.com/api-document/danh-sach-nhom
   */
  async getGroups(): Promise<Array<{ id: number; name: string; sort?: number }>> {
    try {
      const response = await fetch(`${this.baseUrl}/groups`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`GPMLogin API error ${response.status} when getting groups:`, errorText)
        return []
      }

      const responseText = await response.text()
      let data: GpmApiResponse<Array<{ id: number; name: string; sort?: number }>>
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        throw new Error(`GPMLogin API returned non-JSON response. Status: ${response.status}`)
      }

      if (data.success && data.data) {
        return data.data
      }

      return []
    } catch (error) {
      console.error('Error fetching GPMLogin groups:', error)
      return []
    }
  }

  /**
   * Delete profile
   * DELETE /api/v3/profiles/delete/{id}?mode={mode}
   * According to GPMLogin API docs: https://docs.gpmloginapp.com/api-document
   * Mode: 1 = chỉ xóa database, 2 = xóa cả database và nơi lưu trữ (mặc định: 2)
   */
  async deleteProfile(profileId: string, mode: number = 2): Promise<boolean> {
    try {
      // First, try to close the profile if it's running
      // This prevents errors when trying to delete an open profile
      try {
        await this.stopProfile(profileId)
        // Wait a bit for the profile to close
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        // Ignore errors when closing - profile might not be open
        console.log(`Profile ${profileId} might not be open, continuing with delete`)
      }

      const url = new URL(`${this.baseUrl}/profiles/delete/${profileId}`)
      url.searchParams.append('mode', mode.toString())

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000), // 30s timeout for delete
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`GPMLogin API error ${response.status} when deleting profile:`, errorText)
        return false
      }

      const result: GpmApiResponse = await response.json()
      console.log(`GPMLogin delete profile response:`, JSON.stringify(result, null, 2))
      
      if (result.success) {
        return true
      }
      
      console.error(`Failed to delete profile: ${result.message || 'Unknown error'}`)
      return false
    } catch (error) {
      console.error(`Error deleting GPMLogin profile ${profileId}:`, error)
      return false
    }
  }

  /**
   * Format proxy string according to GPMLogin version rules
   * 
   * Global: Requires protocol (defaults to http:// if missing)
   * Local (v3): Strip http://, Keep socks5://
   */
  private formatProxyForApi(proxy: string): string {
    if (!proxy) return ''
    
    // Clean whitespace
    let p = proxy.trim()
    
    const isGlobal = this.apiVersion === '' || this.apiVersion === 'v1' || this.baseUrl.includes('9495')
    const hasSocks5 = p.toLowerCase().startsWith('socks5://')
    const hasHttp = p.toLowerCase().startsWith('http://') || p.toLowerCase().startsWith('https://')
    
    if (isGlobal) {
      // Global prefers protocol
      if (!hasHttp && !hasSocks5) {
        return `http://${p}`
      }
      return p
    } else {
      // Local (v3) prefers raw host for HTTP, but protocol for Socks5
      if (hasHttp) {
        return p.replace(/^https?:\/\//i, '')
      }
      // Keep socks5:// or return raw
      return p
    }
  }
}
