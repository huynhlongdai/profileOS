/**
 * Gán browserConnectionId cho profile GPM chưa có kết nối.
 * Chạy: node scripts/backfill_profile_connections.js
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const local = await prisma.profile.updateMany({
    where: {
      browserProvider: 'gpmlogin',
      browserConnectionId: null,
    },
    data: { browserConnectionId: 'local-gpm' },
  })

  const global = await prisma.profile.updateMany({
    where: {
      browserProvider: 'gpmlogin_global',
      browserConnectionId: null,
    },
    data: { browserConnectionId: 'global-gpm' },
  })

  console.log(`Updated local: ${local.count}, global: ${global.count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
