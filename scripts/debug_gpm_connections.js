const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testUrl(name, apiUrl, apiVersion) {
  const rawUrl = apiUrl.replace(/\/+$/, '')
  let baseUrl
  if (rawUrl.toLowerCase().includes('/api/')) {
    baseUrl = rawUrl
  } else if (apiVersion === '') {
    baseUrl = `${rawUrl}/api`
  } else {
    baseUrl = `${rawUrl}/api/${apiVersion}`
  }

  const testPaths = [
    `${baseUrl}/profiles?page=1&per_page=1`,
    `${baseUrl}/profiles/start/test-id`,
  ]

  console.log(`\n=== ${name} ===`)
  console.log(`baseUrl: ${baseUrl}`)

  for (const url of testPaths) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      const text = (await res.text()).substring(0, 200)
      console.log(`  ${res.status} ${url}`)
      console.log(`    body: ${text.replace(/\n/g, ' ')}`)
    } catch (err) {
      console.log(`  FAIL ${url}`)
      console.log(`    ${err.message}`)
    }
  }
}

async function main() {
  const connections = await prisma.browserConnection.findMany()
  console.log('DB Connections:', JSON.stringify(connections, null, 2))

  const profiles = await prisma.profile.findMany({
    select: { id: true, name: true, browserProvider: true, browserConnectionId: true, profileUid: true },
    take: 5,
  })
  console.log('\nSample profiles:', JSON.stringify(profiles, null, 2))

  for (const c of connections) {
    await testUrl(c.name, c.apiUrl, c.apiVersion)
  }

  console.log('\n=== .env defaults ===')
  await testUrl('env', process.env.GPMLOGIN_API_URL || 'http://127.0.0.1:19995', process.env.GPMLOGIN_API_VERSION || 'v3')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
