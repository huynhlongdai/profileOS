import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { core } from '@/core/bootstrap'

/**
 * POST /api/account-types/migrate - Migrate existing account types from Account.accountType to AccountType model
 * This will:
 * 1. Create AccountType records for all unique accountType values in Account table
 * 2. Update all Account records to link to AccountType via accountTypeId
 */
export async function POST(request: NextRequest) {
  try {
    // Ensure core is initialized
    core.init()
    
    // Verify Prisma Client has AccountType model
    if (!prisma || !(prisma as any).accountType) {
      return NextResponse.json(
        {
          success: false,
          error: 'AccountType model not available in Prisma Client. Please run "npx prisma generate" and restart the server.',
        },
        { status: 500 }
      )
    }
    
    // Step 1: Get all unique accountType values from Account table
    const accounts = await prisma.account.findMany({
      select: {
        accountType: true,
      },
    })

    const uniqueAccountTypes = Array.from(new Set(accounts.map((a) => a.accountType).filter(Boolean)))

    console.log(`Found ${uniqueAccountTypes.length} unique account types:`, uniqueAccountTypes)

    // Step 2: Create AccountType records for each unique accountType
    const accountTypeMap: Record<string, string> = {} // accountType name -> AccountType id

    for (const accountTypeName of uniqueAccountTypes) {
      // Check if AccountType already exists - use prisma directly to avoid service issues
      let accountType: any = null
      try {
        // Try using prisma directly first
        accountType = await (prisma as any).accountType.findUnique({
          where: { name: accountTypeName.toLowerCase() },
        })
      } catch (error) {
        console.error(`Error checking account type ${accountTypeName} with prisma:`, error)
        // Try using service as fallback
        try {
          accountType = await core.services.accountTypeService.getAccountTypeByName(accountTypeName.toLowerCase())
        } catch (serviceError) {
          console.error(`Error checking account type ${accountTypeName} with service:`, serviceError)
          // Continue to create if not found or error
        }
      }

      if (!accountType) {
        // Create new AccountType - use prisma directly to avoid service issues
        const label = accountTypeName
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())

        // Map common types to better labels and icons
        const typeConfig: Record<string, { label: string; icon: string; sortOrder: number }> = {
          gmail: { label: 'Gmail', icon: '📧', sortOrder: 1 },
          coingecko: { label: 'CoinGecko', icon: '🪙', sortOrder: 2 },
          outlook: { label: 'Outlook', icon: '📮', sortOrder: 3 },
          facebook: { label: 'Facebook', icon: '👤', sortOrder: 4 },
          x: { label: 'X (Twitter)', icon: '🐦', sortOrder: 5 },
          custom: { label: 'Custom', icon: '📋', sortOrder: 99 },
        }

        const config = typeConfig[accountTypeName.toLowerCase()] || {
          label,
          icon: '📋',
          sortOrder: 50,
        }

        try {
          // Try using prisma directly first
          accountType = await (prisma as any).accountType.create({
            data: {
              name: accountTypeName.toLowerCase(),
              label: config.label,
              icon: config.icon,
              sortOrder: config.sortOrder,
              isSystem: false,
              isActive: true,
            },
          })
          console.log(`Created AccountType via prisma: ${accountType.name} (${accountType.label})`)
        } catch (prismaError) {
          console.error(`Error creating account type with prisma:`, prismaError)
          // Fallback to service
          try {
            accountType = await core.services.accountTypeService.createAccountType({
              name: accountTypeName.toLowerCase(),
              label: config.label,
              icon: config.icon,
              sortOrder: config.sortOrder,
            })
            console.log(`Created AccountType via service: ${accountType.name} (${accountType.label})`)
          } catch (serviceError) {
            console.error(`Error creating account type with service:`, serviceError)
            throw new Error(`Failed to create account type ${accountTypeName}: ${serviceError instanceof Error ? serviceError.message : String(serviceError)}`)
          }
        }
      }

      accountTypeMap[accountTypeName] = accountType.id
    }

    // Step 3: Update all Account records to link to AccountType
    let updatedCount = 0
    for (const accountTypeName of uniqueAccountTypes) {
      const accountTypeId = accountTypeMap[accountTypeName]
      if (!accountTypeId) continue

      const result = await prisma.account.updateMany({
        where: {
          accountType: accountTypeName,
          accountTypeId: null, // Only update accounts that don't have accountTypeId yet
        },
        data: {
          accountTypeId: accountTypeId,
        },
      })

      updatedCount += result.count
      console.log(`Updated ${result.count} accounts with type "${accountTypeName}"`)
    }

    // Step 4: Initialize default account types (in case some are missing)
    await core.services.accountTypeService.initializeDefaultAccountTypes()

    return NextResponse.json({
      success: true,
      message: `Migration completed: Created/Found ${Object.keys(accountTypeMap).length} account types, Updated ${updatedCount} accounts`,
      accountTypesCreated: Object.keys(accountTypeMap).length,
      accountsUpdated: updatedCount,
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

