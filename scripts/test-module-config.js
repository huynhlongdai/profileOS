const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    const result = await prisma.moduleConfig.findMany()
    console.log('✅ Success! ModuleConfig table exists, count:', result.length)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

