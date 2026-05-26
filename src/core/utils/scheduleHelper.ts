/**
 * Schedule Helper - Tính toán nextRunAt dựa trên schedule type và config
 */

export type ScheduleType = 'interval' | 'daily' | 'weekly'

export interface ScheduleConfig {
  scheduleType: ScheduleType
  intervalMin?: number | null
  hour?: number | null
  minute?: number | null
  daysOfWeek?: number[] | null // [0,1,2,3,4,5,6] where 0=Sunday, 6=Saturday
}

/**
 * Tính toán nextRunAt dựa trên schedule config
 */
export function calculateNextRunAt(
  config: ScheduleConfig,
  lastRunAt: Date | null = null
): Date {
  const now = new Date()
  const baseDate = lastRunAt || now

  switch (config.scheduleType) {
    case 'interval':
      if (!config.intervalMin || config.intervalMin < 1) {
        throw new Error('intervalMin is required for interval schedule type')
      }
      return new Date(baseDate.getTime() + config.intervalMin * 60_000)

    case 'daily':
      if (config.hour === null || config.hour === undefined || config.minute === null || config.minute === undefined) {
        throw new Error('hour and minute are required for daily schedule type')
      }
      return calculateDailyNextRun(now, config.hour, config.minute)

    case 'weekly':
      if (!config.daysOfWeek || config.daysOfWeek.length === 0) {
        throw new Error('daysOfWeek is required for weekly schedule type')
      }
      if (config.hour === null || config.hour === undefined || config.minute === null || config.minute === undefined) {
        throw new Error('hour and minute are required for weekly schedule type')
      }
      return calculateWeeklyNextRun(now, config.daysOfWeek, config.hour, config.minute)

    default:
      throw new Error(`Unknown schedule type: ${config.scheduleType}`)
  }
}

/**
 * Tính nextRunAt cho daily schedule (mỗi ngày vào giờ X:Y)
 */
function calculateDailyNextRun(now: Date, hour: number, minute: number): Date {
  const nextRun = new Date(now)
  nextRun.setHours(hour, minute, 0, 0)

  // Nếu giờ đã qua trong ngày hôm nay, chuyển sang ngày mai
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1)
  }

  return nextRun
}

/**
 * Tính nextRunAt cho weekly schedule (mỗi tuần vào các ngày X, giờ Y:Z)
 */
function calculateWeeklyNextRun(
  now: Date,
  daysOfWeek: number[],
  hour: number,
  minute: number
): Date {
  // Sắp xếp daysOfWeek để tìm ngày gần nhất
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b)
  const currentDayOfWeek = now.getDay() // 0 = Sunday, 6 = Saturday

  // Tìm ngày trong tuần này hoặc tuần sau
  for (const day of sortedDays) {
    if (day > currentDayOfWeek) {
      // Ngày này trong tuần
      const daysUntil = day - currentDayOfWeek
      const nextRun = new Date(now)
      nextRun.setDate(nextRun.getDate() + daysUntil)
      nextRun.setHours(hour, minute, 0, 0)
      return nextRun
    }
  }

  // Nếu tất cả các ngày đã qua trong tuần này, lấy ngày đầu tiên trong tuần sau
  const daysUntil = 7 - currentDayOfWeek + sortedDays[0]
  const nextRun = new Date(now)
  nextRun.setDate(nextRun.getDate() + daysUntil)
  nextRun.setHours(hour, minute, 0, 0)
  return nextRun
}

/**
 * Validate schedule config
 */
export function validateScheduleConfig(config: ScheduleConfig): string | null {
  if (!config.scheduleType) {
    return 'Schedule type is required'
  }

  switch (config.scheduleType) {
    case 'interval':
      if (!config.intervalMin || config.intervalMin < 1) {
        return 'intervalMin must be at least 1 minute'
      }
      break

    case 'daily':
      if (config.hour === null || config.hour === undefined) {
        return 'hour is required for daily schedule'
      }
      if (config.hour < 0 || config.hour > 23) {
        return 'hour must be between 0 and 23'
      }
      if (config.minute === null || config.minute === undefined) {
        return 'minute is required for daily schedule'
      }
      if (config.minute < 0 || config.minute > 59) {
        return 'minute must be between 0 and 59'
      }
      break

    case 'weekly':
      if (!config.daysOfWeek || config.daysOfWeek.length === 0) {
        return 'At least one day of week is required for weekly schedule'
      }
      if (config.daysOfWeek.some((day) => day < 0 || day > 6)) {
        return 'daysOfWeek must be between 0 (Sunday) and 6 (Saturday)'
      }
      if (config.hour === null || config.hour === undefined) {
        return 'hour is required for weekly schedule'
      }
      if (config.hour < 0 || config.hour > 23) {
        return 'hour must be between 0 and 23'
      }
      if (config.minute === null || config.minute === undefined) {
        return 'minute is required for weekly schedule'
      }
      if (config.minute < 0 || config.minute > 59) {
        return 'minute must be between 0 and 59'
      }
      break

    default:
      return `Unknown schedule type: ${config.scheduleType}`
  }

  return null
}

