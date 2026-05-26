/**
 * Gmail Module Configuration
 * 
 * Defines the structure and parsing logic for Gmail module's configJson
 */

export type RandomBehaviorLevel = 'low' | 'medium' | 'high'

export interface GmailModuleConfig {
  /** 
   * Khoảng tối thiểu giữa 2 lần care một account (phút).
   * Dùng để tránh spam hành vi.
   */
  minCareIntervalMinutes: number

  /**
   * Nếu true: khi check thấy logged_out sẽ tự login lại.
   * Nếu false: chỉ báo lỗi, không tự login.
   */
  autoLoginIfLoggedOut: boolean

  /**
   * Nếu true: bỏ qua care khi account mới được login rất gần.
   * Số phút tối thiểu từ lần login cuối để thực hiện care.
   */
  skipCareIfRecentlyLoggedInMinutes: number

  /**
   * Mức độ random behavior (dùng cho nội bộ GmailPageController).
   */
  randomBehaviorLevel: RandomBehaviorLevel
}

const DEFAULT_GMAIL_CONFIG: GmailModuleConfig = {
  minCareIntervalMinutes: 120, // 2 giờ
  autoLoginIfLoggedOut: true,
  skipCareIfRecentlyLoggedInMinutes: 10, // 10 phút
  randomBehaviorLevel: 'medium',
}

/**
 * Parse Gmail config from JSON string
 * Returns default config if parsing fails or configJson is null/undefined
 */
export function parseGmailConfig(configJson?: string | null): GmailModuleConfig {
  if (!configJson) return DEFAULT_GMAIL_CONFIG

  try {
    const parsed = JSON.parse(configJson)
    return {
      minCareIntervalMinutes:
        typeof parsed.minCareIntervalMinutes === 'number' &&
        parsed.minCareIntervalMinutes > 0
          ? parsed.minCareIntervalMinutes
          : DEFAULT_GMAIL_CONFIG.minCareIntervalMinutes,

      autoLoginIfLoggedOut:
        typeof parsed.autoLoginIfLoggedOut === 'boolean'
          ? parsed.autoLoginIfLoggedOut
          : DEFAULT_GMAIL_CONFIG.autoLoginIfLoggedOut,

      skipCareIfRecentlyLoggedInMinutes:
        typeof parsed.skipCareIfRecentlyLoggedInMinutes === 'number' &&
        parsed.skipCareIfRecentlyLoggedInMinutes >= 0
          ? parsed.skipCareIfRecentlyLoggedInMinutes
          : DEFAULT_GMAIL_CONFIG.skipCareIfRecentlyLoggedInMinutes,

      randomBehaviorLevel:
        parsed.randomBehaviorLevel === 'low' ||
        parsed.randomBehaviorLevel === 'medium' ||
        parsed.randomBehaviorLevel === 'high'
          ? parsed.randomBehaviorLevel
          : DEFAULT_GMAIL_CONFIG.randomBehaviorLevel,
    }
  } catch {
    // nếu JSON lỗi → fallback default
    return DEFAULT_GMAIL_CONFIG
  }
}

