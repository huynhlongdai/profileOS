/**
 * Script để kiểm tra chi tiết Change History
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkChangeHistory() {
  try {
    console.log('🔍 Checking Change History...\n')

    // Lấy tất cả change history
    const allHistory = await prisma.accountChangeHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    console.log(`Found ${allHistory.length} total change history records\n`)

    if (allHistory.length > 0) {
      console.log('Recent changes:')
      for (const h of allHistory) {
        const account = await prisma.account.findUnique({
          where: { id: h.accountId },
          select: { label: true, identifier: true },
        })
        console.log(`\n  - ID: ${h.id}`)
        console.log(`    Account: ${account?.label || 'Unknown'} (${h.accountId})`)
        console.log(`    Type: ${h.changeType}`)
        console.log(`    Field: ${h.fieldName || 'N/A'}`)
        console.log(`    Description: ${h.description || 'N/A'}`)
        console.log(`    Date: ${new Date(h.createdAt).toLocaleString('vi-VN')}`)
        console.log(`    Changed by: ${h.changedBy || 'system'}`)
      }
    }

    // Kiểm tra accounts
    const accounts = await prisma.account.findMany({
      take: 5,
      select: {
        id: true,
        label: true,
        identifier: true,
      },
    })

    console.log(`\n\nChecking history for ${accounts.length} accounts:`)
    for (const acc of accounts) {
      const count = await prisma.accountChangeHistory.count({
        where: { accountId: acc.id },
      })
      console.log(`  - ${acc.label}: ${count} records`)
    }
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkChangeHistory()

