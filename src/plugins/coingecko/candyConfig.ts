export type ClaimScheduleMode = 'anytime' | 'fixed_window'

export interface CoinGeckoCandyConfig {
  /**
   * Khoảng tối thiểu giữa 2 lần claim (phút).
   * Dùng để tránh spam / trùng lặp.
   */
  minClaimIntervalMinutes: number

  /**
   * Nếu true, module sẽ tự login nếu phát hiện đang logout.
   */
  autoLoginIfLoggedOut: boolean

  /**
   * Nếu fixed_window: chỉ claim trong khoảng giờ cho phép, ví dụ 7h–11h sáng.
   */
  claimScheduleMode: ClaimScheduleMode
  claimStartHour: number // 0–23
  claimEndHour: number // 0–23

  /**
   * Nếu true: sau khi claim xong sẽ cố gắng xem/hoàn thành một số mission (nếu có).
   */
  tryDoMissions: boolean
}

const DEFAULT_CONFIG: CoinGeckoCandyConfig = {
  minClaimIntervalMinutes: 60,
  autoLoginIfLoggedOut: true,
  claimScheduleMode: 'anytime',
  claimStartHour: 7,
  claimEndHour: 11,
  tryDoMissions: false,
}

export function parseCoinGeckoCandyConfig(
  configJson?: string | null
): CoinGeckoCandyConfig {
  if (!configJson) return DEFAULT_CONFIG

  try {
    const raw = JSON.parse(configJson)

    return {
      minClaimIntervalMinutes:
        typeof raw.minClaimIntervalMinutes === 'number'
          ? raw.minClaimIntervalMinutes
          : DEFAULT_CONFIG.minClaimIntervalMinutes,

      autoLoginIfLoggedOut:
        typeof raw.autoLoginIfLoggedOut === 'boolean'
          ? raw.autoLoginIfLoggedOut
          : DEFAULT_CONFIG.autoLoginIfLoggedOut,

      claimScheduleMode:
        raw.claimScheduleMode === 'fixed_window' ? 'fixed_window' : 'anytime',

      claimStartHour:
        typeof raw.claimStartHour === 'number'
          ? raw.claimStartHour
          : DEFAULT_CONFIG.claimStartHour,

      claimEndHour:
        typeof raw.claimEndHour === 'number'
          ? raw.claimEndHour
          : DEFAULT_CONFIG.claimEndHour,

      tryDoMissions:
        typeof raw.tryDoMissions === 'boolean'
          ? raw.tryDoMissions
          : DEFAULT_CONFIG.tryDoMissions,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

