const { PrismaClient } = require('@prisma/client')

async function checkDatabase(dbUrl, name) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  })
  
  try {
    const [accounts, proxies, profiles, moduleConfigs] = await Promise.all([
      prisma.account.findMany().catch(() => []),
      prisma.proxy.findMany().catch(() => []),
      prisma.profile.findMany().catch(() => []),
      prisma.moduleConfig.findMany().catch(() => [])
    ])
    
    console.log(`\n📊 ${name} (${dbUrl}):`)
    console.log(`   Accounts: ${accounts.length}`)
    console.log(`   Proxies: ${proxies.length}`)
    console.log(`   Profiles: ${profiles.length}`)
    console.log(`   ModuleConfigs: ${moduleConfigs.length}`)
    
    return { accounts: accounts.length, proxies: proxies.length, profiles: profiles.length, moduleConfigs: moduleConfigs.length }
  } catch (error) {
    console.log(`\n❌ ${name} (${dbUrl}): Error - ${error.message}`)
    return null
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await checkDatabase('file:./dev.db', 'Root dev.db')
  await checkDatabase('file:./prisma/dev.db', 'Prisma dev.db')
}

main()

