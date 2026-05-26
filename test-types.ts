import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  const types = await prisma.accountType.findMany()
  console.log("Database Account Types:", types.map(t => `${t.name} -> ${t.loginUrl}`).join('\n'))
}
test().catch(console.error).finally(() => prisma.$disconnect())
