import { prisma } from '@/lib/prisma'

let seeded = false

export async function ensureBuiltinConnections() {
  if (seeded) return
  seeded = true

  const builtins = [
    {
      id: 'local-gpm',
      name: 'GPMLogin Local',
      apiUrl: 'http://127.0.0.1:19995',
      apiVersion: 'v3',
      providerType: 'gpmlogin',
      description: 'Default GPMLogin local connection',
      isEnabled: true,
      isDefault: true,
    },
    {
      id: 'global-gpm',
      name: 'GPMGlobal',
      apiUrl: 'http://127.0.0.1:9495',
      apiVersion: 'v1',
      providerType: 'gpmlogin_global',
      description: 'Default GPMGlobal connection',
      isEnabled: true,
      isDefault: false,
    },
  ]

  for (const conn of builtins) {
    try {
      await prisma.browserConnection.upsert({
        where: { id: conn.id },
        update: {},
        create: conn,
      })
    } catch {
      // ignore if already exists or DB error on startup
    }
  }
}
