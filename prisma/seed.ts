import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed built-in browser connections
  const builtinConnections = [
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

  for (const conn of builtinConnections) {
    await prisma.browserConnection.upsert({
      where: { id: conn.id },
      update: {},
      create: conn,
    })
    console.log(`Seeded: ${conn.id} (${conn.name})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
