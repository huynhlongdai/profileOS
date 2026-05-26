import { prisma } from '@/lib/prisma'
import { BUILTIN_MODULES, ModuleMeta } from '../modules/ModuleRegistry'
import type { ModuleConfig } from '@prisma/client'

export interface ModuleView extends ModuleMeta {
  enabled: boolean
  configJson?: string | null
}

export class ModuleService {
  /**
   * Lấy danh sách module: merge giữa BUILTIN_MODULES và ModuleConfig trong DB
   */
  async listModules(): Promise<ModuleView[]> {
    const configs = await prisma.moduleConfig.findMany()
    const configMap = new Map<string, ModuleConfig>()
    configs.forEach((c) => configMap.set(c.name, c))

    return BUILTIN_MODULES.map((meta) => {
      const cfg = configMap.get(meta.name)
      return {
        ...meta,
        enabled: cfg ? cfg.enabled : true, // mặc định enabled nếu chưa có record
        configJson: cfg?.configJson ?? null,
      }
    })
  }

  /**
   * Bật/tắt module
   */
  async setModuleEnabled(name: string, enabled: boolean): Promise<ModuleView> {
    const meta = BUILTIN_MODULES.find((m) => m.name === name)
    if (!meta) {
      throw new Error(`Unknown module: ${name}`)
    }

    const cfg = await prisma.moduleConfig.upsert({
      where: { name },
      update: { enabled },
      create: {
        name,
        enabled,
      },
    })

    return {
      ...meta,
      enabled: cfg.enabled,
      configJson: cfg.configJson,
    }
  }

  /**
   * Lấy thông tin 1 module
   */
  async getModule(name: string): Promise<ModuleView | null> {
    const meta = BUILTIN_MODULES.find((m) => m.name === name)
    if (!meta) return null

    const cfg = await prisma.moduleConfig.findUnique({
      where: { name },
    })

    return {
      ...meta,
      enabled: cfg?.enabled ?? true,
      configJson: cfg?.configJson ?? null,
    }
  }

  /**
   * Lưu config JSON (tuỳ bạn sử dụng)
   */
  async updateModuleConfig(name: string, configJson: string | null): Promise<ModuleView> {
    const meta = BUILTIN_MODULES.find((m) => m.name === name)
    if (!meta) throw new Error(`Unknown module: ${name}`)

    const cfg = await prisma.moduleConfig.upsert({
      where: { name },
      update: { configJson },
      create: { name, enabled: true, configJson },
    })

    return {
      ...meta,
      enabled: cfg.enabled,
      configJson: cfg.configJson,
    }
  }
}

