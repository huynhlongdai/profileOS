const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding default browser connections...')

  const connections = [
    {
      id: 'local-gpm',
      name: 'GPMLogin Local (Default)',
      apiUrl: 'http://127.0.0.1:19496',
      apiVersion: 'v3',
      providerType: 'gpmlogin',
      description: 'Default local GPMLogin instance (Port 19995)',
      isDefault: true,
    },
    {
      id: 'global-gpm',
      name: 'GPMLogin Global',
      apiUrl: 'http://127.0.0.1:9495',
      apiVersion: 'v1',
      providerType: 'gpmlogin_global',
      description: 'GPM Global — API mặc định port 9495',
      isDefault: true,
    },
  ]

  for (const conn of connections) {
    await prisma.browserConnection.upsert({
      where: { id: conn.id },
      update: conn,
      create: conn,
    })
    console.log(`- ${conn.name} seeded.`)
  }

  // Update existing profiles to use local-gpm by default if they don't have a connection
  const updated = await prisma.profile.updateMany({
    where: {
      browserProvider: 'gpmlogin',
      browserConnectionId: null,
    },
    data: {
      browserConnectionId: 'local-gpm',
    },
  })
  console.log(`Updated ${updated.count} profiles to use local-gpm by default.`)

  console.log('Seed completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
