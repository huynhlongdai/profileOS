import { prisma } from '@/lib/prisma'
import { LogService } from './LogService'
import type { Prisma } from '@prisma/client'

export interface CreateAccountTypePayload {
  name: string
  label: string
  description?: string
  icon?: string
  loginUrl?: string | null
  sortOrder?: number
}

export interface UpdateAccountTypePayload {
  label?: string
  description?: string
  icon?: string
  loginUrl?: string | null
  isActive?: boolean
  sortOrder?: number
}

export class AccountTypeService {
  private logService: LogService

  constructor() {
    this.logService = new LogService()
  }

  /**
   * Get all account types, ordered by sortOrder then name
   */
  async getAllAccountTypes(includeInactive = false): Promise<any[]> {
    try {
      const where: Prisma.AccountTypeWhereInput = {}
      if (!includeInactive) {
        where.isActive = true
      }

      // Ensure prisma is available
      if (!prisma || !prisma.accountType) {
        throw new Error('Prisma client not initialized or AccountType model not available')
      }

      return await prisma.accountType.findMany({
        where,
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
      })
    } catch (error) {
      console.error('Error in getAllAccountTypes:', error)
      throw error
    }
  }

  /**
   * Get account type by name
   */
  async getAccountTypeByName(name: string): Promise<any | null> {
    try {
      // Ensure prisma is available
      if (!prisma || !prisma.accountType) {
        throw new Error('Prisma client not initialized or AccountType model not available')
      }
      return await prisma.accountType.findUnique({
        where: { name },
      })
    } catch (error) {
      console.error('Error in getAccountTypeByName:', error)
      throw error
    }
  }

  /**
   * Get account type by ID
   */
  async getAccountTypeById(id: string): Promise<any | null> {
    try {
      // Ensure prisma is available
      if (!prisma || !prisma.accountType) {
        throw new Error('Prisma client not initialized or AccountType model not available')
      }
      return await prisma.accountType.findUnique({
        where: { id },
      })
    } catch (error) {
      console.error('Error in getAccountTypeById:', error)
      throw error
    }
  }

  /**
   * Create new account type
   */
  async createAccountType(payload: CreateAccountTypePayload): Promise<any> {
    try {
      // Ensure prisma is available
      if (!prisma || !prisma.accountType) {
        throw new Error('Prisma client not initialized or AccountType model not available')
      }

      // Check if name already exists
      const existing = await prisma.accountType.findUnique({
        where: { name: payload.name },
      })

      if (existing) {
        throw new Error(`Account type with name "${payload.name}" already exists`)
      }

      const accountType = await prisma.accountType.create({
        data: {
          name: payload.name.toLowerCase().trim(),
          label: payload.label,
          description: payload.description || null,
          icon: payload.icon || null,
          loginUrl: payload.loginUrl || null,
          sortOrder: payload.sortOrder || 0,
          isSystem: false,
          isActive: true,
        },
      })

      await this.logService.logInfo('core', `Account type created: ${payload.label}`, {
        accountTypeId: accountType.id,
        accountTypeName: accountType.name,
      })

      return accountType
    } catch (error) {
      console.error('Error in createAccountType:', error)
      throw error
    }
  }

  /**
   * Update account type
   */
  async updateAccountType(id: string, payload: UpdateAccountTypePayload): Promise<any> {
    const existing = await prisma.accountType.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new Error('Account type not found')
    }

    if (existing.isSystem) {
      // System types can only update label, description, icon, and sortOrder
      const updateData: any = {}
      if (payload.label !== undefined) updateData.label = payload.label
      if (payload.description !== undefined) updateData.description = payload.description
      if (payload.icon !== undefined) updateData.icon = payload.icon
      if (payload.loginUrl !== undefined) updateData.loginUrl = payload.loginUrl
      if (payload.sortOrder !== undefined) updateData.sortOrder = payload.sortOrder

      return prisma.accountType.update({
        where: { id },
        data: updateData,
      })
    }

    // Non-system types can update everything except name
    const updateData: any = {}
    if (payload.label !== undefined) updateData.label = payload.label
    if (payload.description !== undefined) updateData.description = payload.description
    if (payload.icon !== undefined) updateData.icon = payload.icon
    if (payload.loginUrl !== undefined) updateData.loginUrl = payload.loginUrl
    if (payload.isActive !== undefined) updateData.isActive = payload.isActive
    if (payload.sortOrder !== undefined) updateData.sortOrder = payload.sortOrder

    const accountType = await prisma.accountType.update({
      where: { id },
      data: updateData,
    })

    await this.logService.logInfo('core', `Account type updated: ${accountType.label}`, {
      accountTypeId: accountType.id,
      accountTypeName: accountType.name,
    })

    return accountType
  }

  /**
   * Delete account type (only non-system types)
   */
  async deleteAccountType(id: string): Promise<void> {
    const existing = await prisma.accountType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { accounts: true },
        },
      },
    })

    if (!existing) {
      throw new Error('Account type not found')
    }

    if (existing.isSystem) {
      throw new Error('Cannot delete system account type')
    }

    if (existing._count.accounts > 0) {
      throw new Error(`Cannot delete account type: ${existing._count.accounts} account(s) are using it`)
    }

    await prisma.accountType.delete({
      where: { id },
    })

    await this.logService.logInfo('core', `Account type deleted: ${existing.label}`, {
      accountTypeId: existing.id,
      accountTypeName: existing.name,
    })
  }

  /**
   * Initialize default account types (called on app startup)
   */
  async initializeDefaultAccountTypes(): Promise<void> {
    const defaultTypes = [
      { name: 'gmail', label: 'Gmail', icon: '📧', sortOrder: 1 },
      { name: 'coingecko', label: 'CoinGecko', icon: '🪙', sortOrder: 2 },
      { name: 'outlook', label: 'Outlook', icon: '📮', sortOrder: 3 },
      { name: 'facebook', label: 'Facebook', icon: '👤', sortOrder: 4 },
      { name: 'x', label: 'X (Twitter)', icon: '🐦', sortOrder: 5 },
    ]

    for (const type of defaultTypes) {
      const existing = await prisma.accountType.findUnique({
        where: { name: type.name },
      })

      if (!existing) {
        await prisma.accountType.create({
          data: {
            ...type,
            isSystem: true,
            isActive: true,
          },
        })
      }
    }
  }
}

