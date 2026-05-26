// Create ModuleConfig table in root dev.db (if it exists)
const { PrismaClient } = require('@prisma/client')

// Override DATABASE_URL to use root dev.db
process.env.DATABASE_URL = 'file:./dev.db'

const prisma = new PrismaClient()

async function main() {
  try {
    // Check if table exists
    const result = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name='ModuleConfig';
    `
    
    if (result.length > 0) {
      console.log('✅ ModuleConfig table already exists in root dev.db')
      const count = await prisma.moduleConfig.findMany()
      console.log('   Current records:', count.length)
      return
    }

    // Create table
    await prisma.$executeRaw`
      CREATE TABLE "ModuleConfig" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "configJson" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      );
    `

    // Create unique index
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX "ModuleConfig_name_key" ON "ModuleConfig"("name");
    `

    console.log('✅ ModuleConfig table created successfully in root dev.db')
  } catch (error) {
    if (error.message.includes('Unable to open the database file')) {
      console.log('ℹ️  Root dev.db does not exist, skipping...')
    } else {
      console.error('❌ Error:', error.message)
      throw error
    }
  } finally {
    await prisma.$disconnect()
  }
}

main()

