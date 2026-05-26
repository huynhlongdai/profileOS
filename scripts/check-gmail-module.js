/**
 * Script to check Gmail module status
 */

// Set DATABASE_URL if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db'
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkGmailModule() {
  console.log('🔍 Checking Gmail Module Status...\n')

  try {
    // 1. Check ModuleConfig in database
    console.log('1. Checking ModuleConfig in database:')
    const moduleConfig = await prisma.moduleConfig.findUnique({
      where: { name: 'gmail' },
    })

    if (moduleConfig) {
      console.log('   ✅ ModuleConfig found:')
      console.log(`      - enabled: ${moduleConfig.enabled}`)
      console.log(`      - configJson: ${moduleConfig.configJson || 'null'}`)
    } else {
      console.log('   ⚠️  ModuleConfig not found (will use default: enabled=true)')
    }

    // 2. Check if there are any Gmail accounts
    console.log('\n2. Checking Gmail accounts:')
    const gmailAccounts = await prisma.account.findMany({
      where: { accountType: 'gmail' },
      select: {
        id: true,
        label: true,
        identifier: true,
        status: true,
      },
    })

    console.log(`   Found ${gmailAccounts.length} Gmail account(s)`)
    if (gmailAccounts.length > 0) {
      console.log('   Sample accounts:')
      gmailAccounts.slice(0, 3).forEach((acc) => {
        console.log(`      - ${acc.label} (${acc.identifier}): ${acc.status}`)
      })
    }

    // 3. Check recent logs related to Gmail
    console.log('\n3. Checking recent Gmail logs:')
    const recentLogs = await prisma.log.findMany({
      where: {
        module: 'gmail',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        type: true,
        message: true,
        createdAt: true,
        metaJson: true,
      },
    })

    if (recentLogs.length > 0) {
      console.log(`   Found ${recentLogs.length} recent log(s):`)
      recentLogs.forEach((log) => {
        console.log(
          `      - [${log.type}] ${log.message} (${log.createdAt.toISOString()})`
        )
      })
    } else {
      console.log('   ⚠️  No recent Gmail logs found')
    }

    // 4. Check for errors
    console.log('\n4. Checking for errors:')
    const errors = await prisma.log.findMany({
      where: {
        module: { in: ['gmail', 'core'] },
        type: 'error',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        module: true,
        message: true,
        metaJson: true,
        createdAt: true,
      },
    })

    if (errors.length > 0) {
      console.log(`   ⚠️  Found ${errors.length} recent error(s):`)
      errors.forEach((err) => {
        const meta = err.metaJson ? JSON.parse(err.metaJson) : {}
        console.log(
          `      - [${err.module}] ${err.message} (${err.createdAt.toISOString()})`
        )
        if (meta.error) {
          console.log(`        Error: ${meta.error}`)
        }
      })
    } else {
      console.log('   ✅ No recent errors found')
    }

    // 5. Summary
    console.log('\n📊 Summary:')
    const isEnabled = moduleConfig ? moduleConfig.enabled : true
    console.log(`   - Module enabled: ${isEnabled ? '✅ YES' : '❌ NO'}`)
    console.log(`   - Gmail accounts: ${gmailAccounts.length}`)
    console.log(`   - Recent logs: ${recentLogs.length}`)
    console.log(`   - Recent errors: ${errors.length}`)

    if (!isEnabled) {
      console.log('\n⚠️  WARNING: Gmail module is DISABLED!')
      console.log('   Enable it via: PATCH /api/modules/gmail with { "enabled": true }')
    }

    if (gmailAccounts.length === 0) {
      console.log('\n⚠️  WARNING: No Gmail accounts found!')
    }
  } catch (error) {
    console.error('❌ Error checking Gmail module:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkGmailModule()

