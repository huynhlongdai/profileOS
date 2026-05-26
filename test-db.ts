import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  const accounts = await prisma.account.findMany({
    include: { AccountType: true }
  })
  
  console.log("Accounts count:", accounts.length);
  const firstWithUrl = accounts.find(a => a.AccountType && (a.AccountType as any).loginUrl);
  
  console.log("First with URL:", firstWithUrl?.accountType, (firstWithUrl?.AccountType as any)?.loginUrl);

  const profiles = await prisma.profile.findMany({
    include: {
      accounts: {
        include: { AccountType: true }
      }
    }
  });

  const profile = profiles.find(p => p.accounts.length > 1);
  console.log("Profile with multiple accounts:", profile?.id);
  if (profile) {
    console.log("Accounts in profile:");
    profile.accounts.forEach(a => console.log(a.id, a.accountType, (a.AccountType as any)?.loginUrl));
  }
}
test().catch(console.error).finally(() => prisma.$disconnect())
