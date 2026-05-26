// Check what DATABASE_URL Next.js would use
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const dbUrl = process.env.DATABASE_URL
console.log('DATABASE_URL from env:', dbUrl || 'NOT SET')

// Try to connect with current env
if (dbUrl) {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  
  prisma.moduleConfig.findMany()
    .then(r => {
      console.log('✅ ModuleConfig accessible, count:', r.length)
      prisma.$disconnect()
    })
    .catch(e => {
      console.error('❌ Error accessing ModuleConfig:', e.message)
      prisma.$disconnect()
    })
} else {
  console.log('⚠️  DATABASE_URL not set in environment')
}

