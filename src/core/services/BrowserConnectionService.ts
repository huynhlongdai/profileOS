import { prisma } from '@/lib/prisma'
import { GpmLoginAdapter, normalizeGpmApiUrl } from '@/integrations/GpmLoginAdapter'
import type { BrowserConnection } from '@prisma/client'

export type BrowserConnectionUpdateInput = {
  name?: string
  apiUrl?: string
  apiVersion?: string
  providerType?: string
  description?: string | null
  isEnabled?: boolean
  isDefault?: boolean
}

const BUILTIN_IDS = ['local-gpm', 'global-gpm'] as const

export class BrowserConnectionService {
  async list(): Promise<BrowserConnection[]> {
    return prisma.browserConnection.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
  }

  async getById(id: string): Promise<BrowserConnection | null> {
    return prisma.browserConnection.findUnique({ where: { id } })
  }

  async getDefaultForProvider(providerType: string): Promise<BrowserConnection | null> {
    const preferredId = providerType === 'gpmlogin_global' ? 'global-gpm' : 'local-gpm'
    const byId = await prisma.browserConnection.findFirst({
      where: { id: preferredId, isEnabled: true },
    })
    if (byId) return byId

    return prisma.browserConnection.findFirst({
      where: { providerType, isDefault: true, isEnabled: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async create(data: {
    name: string
    apiUrl: string
    apiVersion?: string
    providerType?: string
    description?: string | null
    isDefault?: boolean
  }): Promise<BrowserConnection> {
    const providerType = data.providerType || 'gpmlogin'

    if (data.isDefault) {
      await prisma.browserConnection.updateMany({
        where: { providerType, isDefault: true },
        data: { isDefault: false },
      })
    }

    return prisma.browserConnection.create({
      data: {
        name: data.name,
        apiUrl: normalizeGpmApiUrl(data.apiUrl),
        apiVersion: data.apiVersion || 'v3',
        providerType,
        description: data.description ?? null,
        isDefault: !!data.isDefault,
      },
    })
  }

  async update(id: string, input: BrowserConnectionUpdateInput): Promise<BrowserConnection> {
    const existing = await prisma.browserConnection.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Kết nối không tồn tại')
    }

    const providerType = input.providerType ?? existing.providerType

    if (input.isDefault) {
      await prisma.browserConnection.updateMany({
        where: { providerType, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    return prisma.browserConnection.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.apiUrl !== undefined && { apiUrl: normalizeGpmApiUrl(input.apiUrl) }),
        ...(input.apiVersion !== undefined && { apiVersion: input.apiVersion }),
        ...(input.providerType !== undefined && { providerType: input.providerType }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      },
    })
  }

  async delete(id: string): Promise<void> {
    const existing = await prisma.browserConnection.findUnique({ where: { id } })
    if (!existing) {
      throw new Error('Kết nối không tồn tại')
    }

    const profileCount = await prisma.profile.count({
      where: { browserConnectionId: id },
    })
    if (profileCount > 0) {
      throw new Error(
        `Không thể xóa: ${profileCount} profile đang dùng kết nối này. Chuyển profile sang kết nối khác trước.`
      )
    }

    await prisma.browserConnection.delete({ where: { id } })
  }

  isBuiltin(id: string): boolean {
    return (BUILTIN_IDS as readonly string[]).includes(id)
  }

  async testById(id: string) {
    const conn = await this.getById(id)
    if (!conn) {
      throw new Error('Kết nối không tồn tại')
    }
    if (!conn.isEnabled) {
      throw new Error('Kết nối đang bị tắt')
    }
    const adapter = new GpmLoginAdapter(conn.apiUrl, conn.apiVersion)
    return adapter.testConnection()
  }

  async testConfig(apiUrl: string, apiVersion: string) {
    const adapter = new GpmLoginAdapter(normalizeGpmApiUrl(apiUrl), apiVersion)
    return adapter.testConnection()
  }
}
