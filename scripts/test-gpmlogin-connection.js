/**
 * Script to test GPMLogin API connection
 */

// Set DATABASE_URL if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db'
}

const GPMLOGIN_API_URL = process.env.GPMLOGIN_API_URL || 'http://127.0.0.1:19995'
const GPMLOGIN_API_VERSION = process.env.GPMLOGIN_API_VERSION || 'v3'

async function testGPMLoginConnection() {
  console.log('🔍 Testing GPMLogin API Connection...\n')
  console.log(`API URL: ${GPMLOGIN_API_URL}`)
  console.log(`API Version: ${GPMLOGIN_API_VERSION}\n`)

  try {
    // Test 1: Check if API is accessible
    console.log('1. Testing API accessibility...')
    const healthUrl = `${GPMLOGIN_API_URL}/api/${GPMLOGIN_API_VERSION}/health`
    try {
      const healthRes = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(5000) })
      console.log(`   ✅ API is accessible (status: ${healthRes.status})`)
    } catch (error) {
      console.log(`   ⚠️  Health check failed: ${error.message}`)
      console.log(`   This is OK, health endpoint might not exist`)
    }

    // Test 2: List profiles
    console.log('\n2. Testing list profiles...')
    const profilesUrl = `${GPMLOGIN_API_URL}/api/${GPMLOGIN_API_VERSION}/profiles?page=1&per_page=5`
    try {
      const profilesRes = await fetch(profilesUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      })

      if (!profilesRes.ok) {
        throw new Error(`HTTP ${profilesRes.status}: ${profilesRes.statusText}`)
      }

      const profilesData = await profilesRes.json()
      console.log(`   ✅ List profiles successful`)
      console.log(`   Found ${profilesData.data?.length || 0} profiles`)

      if (profilesData.data && profilesData.data.length > 0) {
        const firstProfile = profilesData.data[0]
        console.log(`   Sample profile: ${firstProfile.name} (${firstProfile.id})`)
        return firstProfile.id
      }
    } catch (error) {
      console.error(`   ❌ Failed to list profiles:`, error.message)
      throw error
    }

    // Test 3: Get account from DB to test start profile
    console.log('\n3. Testing start profile (if account exists)...')
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient()

    try {
      const account = await prisma.account.findFirst({
        where: { accountType: 'gmail' },
        include: { profile: true },
      })

      if (account && account.profile) {
        console.log(`   Found account with profile: ${account.profile.name} (${account.profile.profileUid})`)
        console.log(`   Profile status: ${account.profile.status}`)
        console.log(`   Remote debugging port: ${account.profile.remoteDebuggingPort || 'N/A'}`)

        // Test start profile
        const startUrl = `${GPMLOGIN_API_URL}/api/${GPMLOGIN_API_VERSION}/profiles/start/${account.profile.profileUid}`
        console.log(`   Attempting to start profile: ${startUrl}`)

        try {
          const startRes = await fetch(startUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(30000),
          })

          if (!startRes.ok) {
            throw new Error(`HTTP ${startRes.status}: ${startRes.statusText}`)
          }

          const startData = await startRes.json()
          console.log(`   ✅ Start profile response:`, JSON.stringify(startData, null, 2))

          if (startData.success && startData.data) {
            const port = startData.data.remote_debugging_port || 
                        (startData.data.remote_debugging_address?.match(/:(\d+)$/)?.[1])
            console.log(`   ✅ Profile started successfully`)
            console.log(`   Remote debugging port: ${port || 'N/A'}`)
            console.log(`   Remote debugging address: ${startData.data.remote_debugging_address || 'N/A'}`)

            // Test connection to port
            if (port) {
              console.log(`\n4. Testing connection to remote debugging port ${port}...`)
              const testUrl = `http://127.0.0.1:${port}`
              try {
                const portRes = await fetch(testUrl, {
                  method: 'GET',
                  signal: AbortSignal.timeout(5000),
                })
                console.log(`   ✅ Port ${port} is accessible (status: ${portRes.status})`)
              } catch (error) {
                console.log(`   ⚠️  Port ${port} is not accessible yet: ${error.message}`)
                console.log(`   This might be normal - port may need a few seconds to be ready`)
              }
            }
          } else {
            console.log(`   ⚠️  Profile start response indicates failure:`, startData.message)
          }
        } catch (error) {
          console.error(`   ❌ Failed to start profile:`, error.message)
        }
      } else {
        console.log(`   ⚠️  No account with profile found in database`)
      }
    } finally {
      await prisma.$disconnect()
    }

    console.log('\n✅ GPMLogin connection test completed')
  } catch (error) {
    console.error('\n❌ GPMLogin connection test failed:', error)
    console.error(error.stack)
  }
}

testGPMLoginConnection()

