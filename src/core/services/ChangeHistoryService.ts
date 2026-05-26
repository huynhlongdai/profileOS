import { prisma } from '@/lib/prisma'

export type AccountChangeType =
  | 'password'
  | 'identifier'
  | 'profile'
  | 'proxy'
  | 'status'
  | 'notes'
  | '2fa'
  | 'login_method'
  | 'label'
  | 'other'

export type ProfileChangeType =
  | 'name'
  | 'proxy'
  | 'status'
  | 'group'
  | 'auto_reset_ip'
  | 'other'

export interface CreateAccountChangeHistoryPayload {
  accountId: string
  changeType: AccountChangeType
  fieldName?: string
  oldValue?: string | null
  newValue?: string | null
  description?: string
  changedBy?: string
}

export interface CreateProfileChangeHistoryPayload {
  profileId: string
  changeType: ProfileChangeType
  fieldName?: string
  oldValue?: string | null
  newValue?: string | null
  description?: string
  changedBy?: string
}

export class ChangeHistoryService {
  /**
   * Ghi lại lịch sử thay đổi của Account
   */
  async recordAccountChange(
    payload: CreateAccountChangeHistoryPayload
  ): Promise<void> {
    try {
      await prisma.accountChangeHistory.create({
        data: {
          accountId: payload.accountId,
          changeType: payload.changeType,
          fieldName: payload.fieldName || null,
          oldValue: payload.oldValue || null,
          newValue: payload.newValue || null,
          description: payload.description || null,
          changedBy: payload.changedBy || 'system',
        },
      })
    } catch (error) {
      // Log error nhưng không throw để không ảnh hưởng đến flow chính
      console.error('[ChangeHistoryService] Error recording account change:', error)
    }
  }

  /**
   * Ghi lại lịch sử thay đổi của Profile
   */
  async recordProfileChange(
    payload: CreateProfileChangeHistoryPayload
  ): Promise<void> {
    try {
      await prisma.profileChangeHistory.create({
        data: {
          profileId: payload.profileId,
          changeType: payload.changeType,
          fieldName: payload.fieldName || null,
          oldValue: payload.oldValue || null,
          newValue: payload.newValue || null,
          description: payload.description || null,
          changedBy: payload.changedBy || 'system',
        },
      })
    } catch (error) {
      // Log error nhưng không throw để không ảnh hưởng đến flow chính
      console.error('[ChangeHistoryService] Error recording profile change:', error)
    }
  }

  /**
   * Lấy lịch sử thay đổi của Account
   */
  async getAccountChangeHistory(
    accountId: string,
    options?: {
      limit?: number
      offset?: number
      changeType?: AccountChangeType
    }
  ) {
    const limit = options?.limit || 50
    const offset = options?.offset || 0

    const where: any = { accountId }
    if (options?.changeType) {
      where.changeType = options.changeType
    }

    const [history, total] = await Promise.all([
      prisma.accountChangeHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.accountChangeHistory.count({ where }),
    ])

    return {
      history,
      total,
      limit,
      offset,
    }
  }

  /**
   * Lấy lịch sử thay đổi của Profile
   */
  async getProfileChangeHistory(
    profileId: string,
    options?: {
      limit?: number
      offset?: number
      changeType?: ProfileChangeType
    }
  ) {
    const limit = options?.limit || 50
    const offset = options?.offset || 0

    const where: any = { profileId }
    if (options?.changeType) {
      where.changeType = options.changeType
    }

    const [history, total] = await Promise.all([
      prisma.profileChangeHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.profileChangeHistory.count({ where }),
    ])

    return {
      history,
      total,
      limit,
      offset,
    }
  }

  /**
   * Xóa lịch sử thay đổi của Account
   */
  async deleteAccountChangeHistory(
    accountId: string,
    options?: {
      changeType?: AccountChangeType
      beforeDate?: Date
    }
  ): Promise<number> {
    const where: any = { accountId }
    
    if (options?.changeType) {
      where.changeType = options.changeType
    }
    
    if (options?.beforeDate) {
      where.createdAt = { lt: options.beforeDate }
    }

    const result = await prisma.accountChangeHistory.deleteMany({ where })
    return result.count
  }

  /**
   * Xóa lịch sử thay đổi của Profile
   */
  async deleteProfileChangeHistory(
    profileId: string,
    options?: {
      changeType?: ProfileChangeType
      beforeDate?: Date
    }
  ): Promise<number> {
    const where: any = { profileId }
    
    if (options?.changeType) {
      where.changeType = options.changeType
    }
    
    if (options?.beforeDate) {
      where.createdAt = { lt: options.beforeDate }
    }

    const result = await prisma.profileChangeHistory.deleteMany({ where })
    return result.count
  }

  /**
   * Xóa một record lịch sử cụ thể (Account)
   */
  async deleteAccountChangeHistoryById(id: string): Promise<void> {
    await prisma.accountChangeHistory.delete({
      where: { id },
    })
  }

  /**
   * Xóa một record lịch sử cụ thể (Profile)
   */
  async deleteProfileChangeHistoryById(id: string): Promise<void> {
    await prisma.profileChangeHistory.delete({
      where: { id },
    })
  }
}

