'use client'

import { useState, useEffect } from 'react'
import { useToastContext } from './ToastProvider'
import SearchableSelect from './SearchableSelect'

interface AccountFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  accountId?: string
}

interface Profile {
  id: string
  name: string
  profileUid: string
  browserType?: string | null
}

interface Proxy {
  id: string
  label: string
  rawProxy: string
}

interface Group {
  id: number
  name: string
}

interface ParentAccount {
  id: string
  label: string
  identifier: string
  accountType: string
  gpmloginProfileId?: string | null
}

interface AccountType {
  id: string
  name: string
  label: string
  icon: string | null
  isActive: boolean
}

export default function AccountForm({
  isOpen,
  onClose,
  onSuccess,
  accountId,
}: AccountFormProps) {
  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [proxies, setProxies] = useState<Proxy[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [parentAccounts, setParentAccounts] = useState<ParentAccount[]>([])
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])
  const [profileBrowserTypeFilter, setProfileBrowserTypeFilter] = useState<string>('')
  const { showToast } = useToastContext()
  const [formData, setFormData] = useState({
    label: '',
    accountType: (typeof window !== 'undefined' ? localStorage.getItem('last_account_type') : null) || 'gmail',
    customAccountType: '',
    identifier: '',
    password: '',
    twoFactorSecret: '',
    loginMethod: 'PASSWORD' as 'PASSWORD' | 'GOOGLE_OAUTH',
    authViaAccountId: '',
    gpmloginProfileId: '',
    proxyId: '',
    autoChangeProxy: false,
    autoCreateProfile: false,
    autoCreateProfileGroupId: '',
    autoCreateProfileBrowserType: 'gpm' as 'chromium' | 'firefox' | 'gpm',
    autoCreateProfileBrowserProvider: 'gpmlogin' as 'gpmlogin' | 'gpmlogin_global' | 'chrome' | 'firefox',
    notes: '',
    customLoginUrl: '',
  })

  useEffect(() => {
    if (isOpen) {
      // Fetch account types first, then other data
      fetchAccountTypes().then(() => {
        fetchProxies()
        fetchGroups()
        fetchParentAccounts()
        if (accountId) {
          fetchAccount()
        }
      })
      // Fetch profiles separately to allow browser type filtering
      fetchProfiles()
    }
  }, [isOpen, accountId, profileBrowserTypeFilter])

  useEffect(() => {
    // Reset authViaAccountId when accountType changes (unless it's gmail which can be parent)
    if (formData.accountType === 'gmail') {
      // Gmail can be parent, so don't auto-clear
    } else {
      // For child account types, keep authViaAccountId if already set
    }
  }, [formData.accountType])

  // Auto-fill identifier when authViaAccountId is selected
  useEffect(() => {
    if (formData.authViaAccountId && parentAccounts.length > 0) {
      const selectedParent = parentAccounts.find((acc) => acc.id === formData.authViaAccountId)
      if (selectedParent) {
        // Auto-fill identifier from selected parent account
        // Only if identifier is empty or matches a previous parent account's identifier
        const shouldAutoFill = !formData.identifier ||
          parentAccounts.some(acc => acc.identifier === formData.identifier)

        if (shouldAutoFill) {
          setFormData((prev) => ({
            ...prev,
            identifier: selectedParent.identifier,
          }))
        }
      }
    }
  }, [formData.authViaAccountId, parentAccounts])

  const fetchAccountTypes = async () => {
    try {
      const res = await fetch('/api/account-types')
      const data = await res.json()
      if (data.success && data.accountTypes) {
        // Filter only active account types and sort by sortOrder
        const activeTypes = data.accountTypes
          .filter((type: AccountType) => type.isActive)
          .sort((a: AccountType, b: AccountType) => {
            // Sort by sortOrder first, then by name
            if ((a as any).sortOrder !== (b as any).sortOrder) {
              return (a as any).sortOrder - (b as any).sortOrder
            }
            return a.name.localeCompare(b.name)
          })
        setAccountTypes(activeTypes)

        // Set default account type to first available type if not set
        if (activeTypes.length > 0 && !accountId && formData.accountType === 'gmail') {
          const defaultType = activeTypes.find((t: AccountType) => t.name === 'gmail') || activeTypes[0]
          setFormData(prev => ({ ...prev, accountType: defaultType.name }))
        }
      }
    } catch (error) {
      console.error('Error fetching account types:', error)
    }
  }

  const fetchProfiles = async () => {
    try {
      const params = new URLSearchParams()
      if (profileBrowserTypeFilter) {
        params.append('browserType', profileBrowserTypeFilter)
      }
      const res = await fetch(`/api/profiles?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setProfiles(data.profiles)
      }
    } catch (error) {
      console.error('Error fetching profiles:', error)
    }
  }

  const fetchProxies = async () => {
    try {
      const res = await fetch('/api/proxies')
      const data = await res.json()
      if (data.success) {
        setProxies(data.proxies)
      }
    } catch (error) {
      console.error('Error fetching proxies:', error)
    }
  }

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups')
      const data = await res.json()
      if (data.success) {
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  const fetchParentAccounts = async () => {
    try {
      // Fetch Gmail accounts that can be used as parent accounts
      const res = await fetch('/api/accounts?type=gmail&limit=1000')
      const data = await res.json()
      if (data.success) {
        setParentAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error('Error fetching parent accounts:', error)
    }
  }

  const fetchAccount = async () => {
    if (!accountId) return
    try {
      const res = await fetch(`/api/accounts/${accountId}`)
      const data = await res.json()
      if (data.success && data.account) {
        const accountType = data.account.accountType || 'gmail'
        // Check if accountType exists in the accountTypes list
        // accountTypes should already be loaded from useEffect, but check again if empty
        let currentTypes = accountTypes
        if (currentTypes.length === 0) {
          const typesRes = await fetch('/api/account-types')
          const typesData = await typesRes.json()
          if (typesData.success) {
            currentTypes = typesData.accountTypes.filter((t: AccountType) => t.isActive)
          }
        }

        const typeExists = currentTypes.some((type: AccountType) => type.name === accountType)
        const isCustomType = !typeExists && accountType !== 'custom'

        setFormData({
          label: data.account.label || '',
          accountType: isCustomType ? 'custom' : accountType,
          customAccountType: isCustomType ? accountType : '',
          identifier: data.account.identifier || '',
          password: '', // Don't show password
          twoFactorSecret: data.account.twoFactorSecret || '',
          loginMethod: (data.account.loginMethod as 'PASSWORD' | 'GOOGLE_OAUTH') || 'PASSWORD',
          authViaAccountId: data.account.authViaAccountId || '',
          gpmloginProfileId: data.account.gpmloginProfileId || '',
          proxyId: data.account.proxyId || '',
          autoChangeProxy: data.account.autoChangeProxy || false,
          autoCreateProfile: false, // Only for new accounts
          autoCreateProfileGroupId: '', // Only for new accounts
          autoCreateProfileBrowserType: 'gpm', // Only for new accounts
          autoCreateProfileBrowserProvider: 'gpmlogin', // Only for new accounts
          notes: data.account.notes || '',
          customLoginUrl: data.account.customLoginUrl || '',
        })
      }
    } catch (error) {
      console.error('Error fetching account:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = accountId ? `/api/accounts/${accountId}` : '/api/accounts'
      const method = accountId ? 'PUT' : 'POST'

      // Determine final account type
      const finalAccountType = formData.accountType === 'custom'
        ? formData.customAccountType.trim()
        : formData.accountType

      if (!finalAccountType) {
        showToast('Account Type is required', 'error')
        setLoading(false)
        return
      }

      const payload: any = {
        // Label is auto-generated by backend, don't send it
        accountType: finalAccountType,
        identifier: formData.identifier,
        loginMethod: formData.loginMethod,
        authViaAccountId: formData.authViaAccountId || undefined,
        gpmloginProfileId: formData.gpmloginProfileId || undefined,
        proxyId: formData.proxyId || undefined,
        autoChangeProxy: formData.autoChangeProxy,
        notes: formData.notes || undefined,
        customLoginUrl: formData.customLoginUrl || undefined,
      }

      if (formData.password) {
        payload.password = formData.password
      }

      if (formData.twoFactorSecret) {
        payload.twoFactorSecret = formData.twoFactorSecret.trim()
      }

      // Only allow autoCreateProfile for new accounts
      // IMPORTANT: Only auto-create profile if:
      // 1. Creating new account (not editing)
      // 2. autoCreateProfile is true
      // 3. No existing profile is selected (gpmloginProfileId is empty)
      if (!accountId && formData.autoCreateProfile && !formData.gpmloginProfileId) {
        payload.autoCreateProfile = true
        if (formData.autoCreateProfileGroupId) {
          payload.autoCreateProfileGroupId = formData.autoCreateProfileGroupId
        }
        payload.autoCreateProfileBrowserType = formData.autoCreateProfileBrowserType
        payload.autoCreateProfileBrowserProvider = formData.autoCreateProfileBrowserProvider
      } else {
        // Explicitly set to false to prevent auto-creation when using existing profile
        payload.autoCreateProfile = false
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (data.success) {
        showToast(
          accountId ? 'Account updated successfully' : 'Account created successfully',
          'success'
        )
        onSuccess()
        onClose()
        // Reset form, but keep the last-used account type
        const savedType = typeof window !== 'undefined' ? localStorage.getItem('last_account_type') || 'gmail' : 'gmail'
        setFormData({
          label: '',
          accountType: savedType,
          customAccountType: '',
          identifier: '',
          password: '',
          twoFactorSecret: '',
          loginMethod: 'PASSWORD',
          authViaAccountId: '',
          gpmloginProfileId: '',
          proxyId: '',
          autoChangeProxy: false,
          autoCreateProfile: false,
          autoCreateProfileGroupId: '',
          autoCreateProfileBrowserType: 'gpm',
          autoCreateProfileBrowserProvider: 'gpmlogin',
          notes: '',
          customLoginUrl: '',
        })
      } else {
        showToast(data.error || 'Unknown error', 'error')
      }
    } catch (error) {
      console.error('Error saving account:', error)
      showToast('Error saving account. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-800">
            ℹ️ Label sẽ được hệ thống tự động tạo theo format 4 số tăng dần (0001, 0002, 0003...)
          </p>
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700">
            Account Type *
          </label>
          <select
            required
            value={formData.accountType}
            onChange={(e) => {
              const newType = e.target.value
              // Remember this choice for next time
              if (typeof window !== 'undefined') {
                localStorage.setItem('last_account_type', newType)
              }
              setFormData({
                ...formData,
                accountType: newType,
                customAccountType: newType === 'custom' ? formData.customAccountType : '',
              })
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            style={{ zIndex: 10 }}
          >
            {accountTypes.map((type) => (
              <option key={type.id} value={type.name} className="text-gray-900">
                {type.icon ? `${type.icon} ` : ''}{type.label}
              </option>
            ))}
            <option value="custom" className="text-gray-900">📋 Custom (Enter below)</option>
          </select>
          {formData.accountType === 'custom' && (
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700">
                Custom Account Type *
              </label>
              <input
                type="text"
                required={formData.accountType === 'custom'}
                value={formData.customAccountType}
                onChange={(e) => {
                  // Only allow alphanumeric, underscore, and hyphen
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
                  setFormData({ ...formData, customAccountType: value })
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., instagram, tiktok, telegram"
              />
              <p className="mt-1 text-xs text-gray-500">
                Chỉ chứa chữ cái thường, số, dấu gạch dưới (_) và dấu gạch ngang (-)
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Identifier (Email/Username) *
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              required
              value={formData.identifier}
              onChange={(e) =>
                setFormData({ ...formData, identifier: e.target.value })
              }
              className="flex-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="user@example.com"
            />
            {formData.authViaAccountId && (
              <button
                type="button"
                onClick={() => {
                  const selectedParent = parentAccounts.find((acc) => acc.id === formData.authViaAccountId)
                  if (selectedParent) {
                    setFormData((prev) => ({
                      ...prev,
                      identifier: selectedParent.identifier,
                    }))
                  }
                }}
                className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:text-blue-700 transition-colors whitespace-nowrap"
                title="Sử dụng identifier từ account được chọn"
              >
                📋 Dùng từ account
              </button>
            )}
          </div>
          {formData.authViaAccountId && (
            <p className="mt-1 text-xs text-gray-500">
              💡 Gợi ý: Click "Dùng từ account" để tự động điền identifier từ account được chọn ở "Login via Account"
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Login Method *
          </label>
          <select
            required
            value={formData.loginMethod}
            onChange={(e) =>
              setFormData({
                ...formData,
                loginMethod: e.target.value as 'PASSWORD' | 'GOOGLE_OAUTH',
              })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          >
            <option value="PASSWORD" className="text-gray-900">Password (Email/Password)</option>
            <option value="GOOGLE_OAUTH" className="text-gray-900">Google OAuth</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {formData.loginMethod === 'GOOGLE_OAUTH'
              ? 'Sử dụng Google OAuth để login. Cần link với Gmail account qua "Login via Account" bên dưới.'
              : 'Sử dụng email/password để login trực tiếp.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Password {accountId ? '(leave empty to keep current)' : formData.loginMethod === 'PASSWORD' ? '*' : ''}
          </label>
          <input
            type="password"
            required={!accountId && formData.loginMethod === 'PASSWORD'}
            disabled={formData.loginMethod === 'GOOGLE_OAUTH'}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
            placeholder={formData.loginMethod === 'GOOGLE_OAUTH' ? 'Not needed for Google OAuth' : 'Password'}
          />
          {formData.loginMethod === 'GOOGLE_OAUTH' && (
            <p className="mt-1 text-xs text-gray-500">
              Password không cần thiết khi sử dụng Google OAuth.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            2FA Secret Key (TOTP)
          </label>
          <input
            type="text"
            value={formData.twoFactorSecret}
            onChange={(e) =>
              setFormData({ ...formData, twoFactorSecret: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder="Base32 secret key (e.g., JBSWY3DPEHPK3PXP)"
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter your TOTP secret key for 2FA code generation
          </p>
        </div>

        {/* Login via Account (for child accounts) */}
        {formData.accountType !== 'gmail' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Login via Account (Optional)
            </label>
            <SearchableSelect
              value={formData.authViaAccountId}
              onChange={(selectedAccountId) => {
                const selectedParent = parentAccounts.find((acc) => acc.id === selectedAccountId)

                const updates: any = {
                  authViaAccountId: selectedAccountId,
                  identifier: selectedParent ? selectedParent.identifier : formData.identifier,
                }

                // Tự động chọn profile của account vừa chọn
                if (selectedParent?.gpmloginProfileId) {
                  updates.gpmloginProfileId = selectedParent.gpmloginProfileId
                  updates.autoCreateProfile = false
                  updates.proxyId = ''
                  updates.autoChangeProxy = false
                }

                setFormData({
                  ...formData,
                  ...updates,
                })
              }}
              options={parentAccounts
                .filter((acc) => acc.id !== accountId)
                .map((acc) => ({
                  value: acc.id,
                  label: `${acc.label} - ${acc.identifier}`,
                  sublabel: acc.accountType,
                }))}
              placeholder="Search account..."
              emptyOption="-- None (Login directly) --"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">
              Chọn một Gmail account để dùng chung profile và login method.
              Nếu chọn, account này sẽ reuse profile của account được chọn.
              Identifier sẽ tự động được điền từ account được chọn.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Browser Profile
          </label>
          <div className="mt-1 space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Filter by Browser Type
              </label>
              <select
                value={profileBrowserTypeFilter}
                onChange={(e) => {
                  setProfileBrowserTypeFilter(e.target.value)
                }}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="">Tất cả (Chrome, Firefox, GPM)</option>
                <option value="chromium">Chrome/Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="gpm">GPM Browser</option>
              </select>
            </div>
            <SearchableSelect
              value={formData.gpmloginProfileId}
              onChange={(newProfileId) => {
                setFormData({
                  ...formData,
                  gpmloginProfileId: newProfileId,
                  // Clear autoCreateProfile if selecting existing profile
                  autoCreateProfile: newProfileId ? false : formData.autoCreateProfile,
                  // Clear proxy and autoChangeProxy if selecting existing profile
                  proxyId: newProfileId ? '' : formData.proxyId,
                  autoChangeProxy: newProfileId ? false : formData.autoChangeProxy,
                })
              }}
              options={profiles.map((profile) => {
                const getBrowserTypeLabel = (browserType: string | null | undefined) => {
                  if (!browserType) return 'Unknown'
                  const type = browserType.toLowerCase()
                  if (type === 'chromium' || type === 'chrome') return 'Chrome'
                  if (type === 'firefox') return 'Firefox'
                  if (type === 'gpm') return 'GPM'
                  return browserType
                }
                return {
                  value: profile.id,
                  label: profile.name,
                  sublabel: `${profile.profileUid} · ${getBrowserTypeLabel(profile.browserType)}`,
                }
              })}
              placeholder="Search profile..."
              emptyOption="-- Select Profile --"
            />
          </div>
        </div>

        {!accountId && (
          <>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoCreateProfile"
                checked={formData.autoCreateProfile}
                onChange={(e) => {
                  const checked = e.target.checked
                  setFormData({
                    ...formData,
                    autoCreateProfile: checked,
                    // Clear existing profile selection if auto-creating
                    gpmloginProfileId: checked ? '' : formData.gpmloginProfileId,
                  })
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="autoCreateProfile" className="ml-2 text-sm text-gray-700">
                Tự động tạo Profile
              </label>
              <p className="ml-2 text-xs text-gray-500">
                (Tự động tạo profile mới và gán cho tài khoản này)
              </p>
            </div>
            {formData.autoCreateProfile && !formData.gpmloginProfileId && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Group cho Profile mới
                  </label>
                  <select
                    value={formData.autoCreateProfileGroupId}
                    onChange={(e) =>
                      setFormData({ ...formData, autoCreateProfileGroupId: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">-- No Group --</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Chọn nhóm cho profile sẽ được tạo tự động
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Browser Provider cho Profile mới
                  </label>
                  <select
                    value={formData.autoCreateProfileBrowserProvider}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        autoCreateProfileBrowserProvider: e.target.value as 'gpmlogin' | 'gpmlogin_global' | 'chrome' | 'firefox',
                        // Update browserType based on provider
                        autoCreateProfileBrowserType: e.target.value === 'firefox' ? 'firefox' : e.target.value === 'chrome' ? 'chromium' : 'gpm',
                      })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="gpmlogin">GPMLogin (Local)</option>
                    <option value="gpmlogin_global">GPMLogin Global (Port 9495)</option>
                    <option value="chrome">Chrome Browser</option>
                    <option value="firefox">Firefox Browser</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Chọn trình duyệt để tạo profile. GPMLogin được khuyến nghị cho antidetect.
                  </p>
                </div>

                {/* Proxy and Auto Change Proxy - shown after Group */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Proxy
                  </label>
                  <select
                    value={formData.proxyId}
                    onChange={(e) =>
                      setFormData({ ...formData, proxyId: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">-- Select Proxy --</option>
                    {proxies.map((proxy) => (
                      <option key={proxy.id} value={proxy.id}>
                        {proxy.label} ({proxy.rawProxy})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoChangeProxy"
                    checked={formData.autoChangeProxy}
                    onChange={(e) =>
                      setFormData({ ...formData, autoChangeProxy: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="autoChangeProxy" className="ml-2 text-sm text-gray-700">
                    Auto Change Proxy
                  </label>
                </div>
              </>
            )}
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder="Optional notes..."
          />
        </div>

        <div className="bg-amber-50/30 border border-amber-200/50 rounded-md p-3">
          <label className="block text-sm font-medium text-gray-700">
            Custom Startup URL
          </label>
          <input
            type="text"
            value={formData.customLoginUrl}
            onChange={(e) =>
              setFormData({ ...formData, customLoginUrl: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder="https://example.com/login?u={identifier}"
          />
          <div className="mt-2 text-[10px] text-gray-500 grid grid-cols-2 gap-1">
            <span className="bg-white/50 px-1 py-0.5 rounded border border-gray-100"><code>{'{identifier}'}</code> Email/Username</span>
            <span className="bg-white/50 px-1 py-0.5 rounded border border-gray-100"><code>{'{label}'}</code> Account Label</span>
            <span className="bg-white/50 px-1 py-0.5 rounded border border-gray-100"><code>{'{id}'}</code> Account ID</span>
          </div>
          <p className="mt-1.5 text-xs text-amber-700 leading-relaxed">
            💡 URL này sẽ được mở ngay sau khi trình duyệt khởi động. Nếu không điền, hệ thống sẽ dùng URL mặc định của loại tài khoản.
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : accountId ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

