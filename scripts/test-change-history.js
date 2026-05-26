/**
 * Script để test tính năng Change History
 * Chạy: node scripts/test-change-history.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testChangeHistory() {
  console.log('🔍 Testing Change History Feature...\n')

  try {
    // 1. Kiểm tra tables có tồn tại không
    console.log('1. Checking if tables exist...')
    try {
      const accountHistoryCount = await prisma.accountChangeHistory.count()
      const profileHistoryCount = await prisma.profileChangeHistory.count()
      console.log(`   ✅ AccountChangeHistory table exists (${accountHistoryCount} records)`)
      console.log(`   ✅ ProfileChangeHistory table exists (${profileHistoryCount} records)`)
    } catch (error) {
      console.error('   ❌ Tables not found:', error.message)
      console.log('   💡 Run: npx prisma db push')
      return
    }

    // 2. Kiểm tra có account nào không
    console.log('\n2. Checking for accounts...')
    const accounts = await prisma.account.findMany({ take: 1 })
    if (accounts.length === 0) {
      console.log('   ⚠️  No accounts found. Create an account first to test change history.')
      return
    }
    const testAccount = accounts[0]
    console.log(`   ✅ Found account: ${testAccount.label} (${testAccount.id})`)

    // 3. Kiểm tra lịch sử thay đổi của account
    console.log('\n3. Checking change history for account...')
    const history = await prisma.accountChangeHistory.findMany({
      where: { accountId: testAccount.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    console.log(`   ✅ Found ${history.length} change history records`)
    if (history.length > 0) {
      console.log('   Recent changes:')
      history.forEach((h, i) => {
        console.log(`      ${i + 1}. ${h.changeType} - ${h.description || 'No description'}`)
        console.log(`         Date: ${new Date(h.createdAt).toLocaleString('vi-VN')}`)
      })
    } else {
      console.log('   ⚠️  No change history found. Try updating the account to generate history.')
    }

    // 4. Kiểm tra có profile nào không
    console.log('\n4. Checking for profiles...')
    const profiles = await prisma.profile.findMany({ take: 1 })
    if (profiles.length > 0) {
      const testProfile = profiles[0]
      console.log(`   ✅ Found profile: ${testProfile.name} (${testProfile.id})`)

      const profileHistory = await prisma.profileChangeHistory.findMany({
        where: { profileId: testProfile.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
      console.log(`   ✅ Found ${profileHistory.length} change history records for profile`)
      if (profileHistory.length > 0) {
        console.log('   Recent changes:')
        profileHistory.forEach((h, i) => {
          console.log(`      ${i + 1}. ${h.changeType} - ${h.description || 'No description'}`)
          console.log(`         Date: ${new Date(h.createdAt).toLocaleString('vi-VN')}`)
        })
      }
    } else {
      console.log('   ⚠️  No profiles found')
    }

    console.log('\n✅ Change History test completed!')
    console.log('\n💡 To test:')
    console.log('   1. Update an account (change password, profile, etc.)')
    console.log('   2. Check the Change History tab in Account Detail Modal')
    console.log('   3. Verify the changes are recorded')
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testChangeHistory()

