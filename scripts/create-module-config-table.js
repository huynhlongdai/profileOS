const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    // Check if table exists
    const result = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name='ModuleConfig';
    `
    
    if (result.length > 0) {
      console.log('✅ ModuleConfig table already exists')
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

    console.log('✅ ModuleConfig table created successfully')
  } catch (error) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()

