import { NextRequest, NextResponse } from 'next/server'
import { AccountService } from '@/core/services/AccountService'
import { ProfileService } from '@/core/services/ProfileService'
import { ProxyService } from '@/core/services/ProxyService'

const accountService = new AccountService()
const profileService = new ProfileService()
const proxyService = new ProxyService()

/**
 * POST /api/accounts/import - Import accounts from CSV or JSON
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accounts, format } = body

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid accounts data' },
        { status: 400 }
      )
    }

    let imported = 0
    let errors: string[] = []

    for (const accountData of accounts) {
      try {
        // Validate required fields
        if (!accountData.identifier || (!accountData.label && !accountData.accountType)) {
          errors.push(`Skipping account: missing required fields (${accountData.identifier || 'unknown'})`)
          continue
        }

        // Resolve profile ID from profile name or ID
        let profileId: string | null = null
        if (accountData.profileId) {
          // Try to resolve the profileId: first as internal CUID, then as profileUid (GPMLogin UID)
          const resolvedProfile = await profileService.getProfile(accountData.profileId)
          if (resolvedProfile) {
            profileId = resolvedProfile.id
          } else {
            errors.push(`Profile not found (id/uid: ${accountData.profileId}) for account ${accountData.identifier}`)
          }
        } else if (accountData.profileName || accountData.profile) {
          const profileName = accountData.profileName || accountData.profile
          const profiles = await profileService.listProfiles()
          const profile = profiles.find((p) => p.name === profileName)
          if (profile) {
            profileId = profile.id
          } else {
            errors.push(`Profile not found: ${profileName} for account ${accountData.identifier}`)
          }
        }

        // Resolve proxy ID from proxy label or ID
        let proxyId: string | null = null
        if (accountData.proxyId) {
          proxyId = accountData.proxyId
        } else if (accountData.proxyLabel || accountData.proxy) {
          const proxyLabel = accountData.proxyLabel || accountData.proxy
          const proxies = await proxyService.listProxies()
          const proxy = proxies.find((p) => p.label === proxyLabel)
          if (proxy) {
            proxyId = proxy.id
          } else {
            errors.push(`Proxy not found: ${proxyLabel} for account ${accountData.identifier}`)
          }
        }

        // Determine account type
        const accountType = accountData.accountType || accountData.accounttype || 'gmail'

        // Determine label (generate if not provided)
        const label = accountData.label || accountData.Label || `GM${Math.random().toString(36).substring(2, 8).toUpperCase()}`

        const account = await accountService.createAccount({
          label,
          accountType,
          identifier: accountData.identifier || accountData.Identifier,
          passwordEncrypted: accountData.password || accountData.passwordEncrypted || accountData.Password || null,
          twoFactorSecret: accountData.twoFactorSecret || accountData.twofactorsecret || accountData['2FA Secret'] || null,
          gpmloginProfileId: profileId || undefined,
          proxyId: proxyId || undefined,
          autoChangeProxy: accountData.autoChangeProxy === true || accountData.autochangeproxy === 'true' || accountData.autoChangeProxy === 'true' || false,
          notes: accountData.notes || accountData.Notes || undefined,
          autoCreateProfile: accountData.autoCreateProfile === true || accountData.autocreateprofile === 'true' || accountData['Auto Create Profile'] === 'true' || false,
          autoCreateProfileGroupId: accountData.autoCreateProfileGroupId || accountData.autocreateprofilegroupid || accountData['Auto Create Profile Group Id'] || undefined,
        })

        // Update status if provided and different from default
        const status = accountData.status || accountData.Status
        if (status && status !== 'active') {
          await accountService.updateAccount(account.id, { status })
        }

        imported++
      } catch (error) {
        errors.push(
          `Failed to import ${accountData.label || accountData.identifier}: ${error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      total: accounts.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

