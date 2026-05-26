'use client'

import { useRef, useCallback } from 'react'
import SearchableSelect from './SearchableSelect'

export interface QuickAddRowData {
  id: string // local uuid for keying
  accountType: string
  identifier: string
  password: string
  twoFactorSecret: string
  authViaAccountId: string
  gpmloginProfileId: string
  loginMethod: string
  notes: string
}

export interface QuickAddAccountType {
  id: string
  name: string
  label: string
  icon: string | null
}

export interface QuickAddParentAccount {
  id: string
  label: string
  identifier: string
  accountType: string
  gpmloginProfileId?: string | null
}

export interface QuickAddProfile {
  id: string
  name: string
  profileUid: string
  browserType?: string | null
}

interface QuickAddAccountRowProps {
  rowIndex: number
  data: QuickAddRowData
  onChange: (data: QuickAddRowData) => void
  onDelete: () => void
  onAddNext: () => void
  accountTypes: QuickAddAccountType[]
  parentAccounts: QuickAddParentAccount[]
  profiles: QuickAddProfile[]
  isSubmitting: boolean
  status?: 'idle' | 'success' | 'error'
  errorMsg?: string
}

export default function QuickAddAccountRow({
  rowIndex,
  data,
  onChange,
  onDelete,
  onAddNext,
  accountTypes,
  parentAccounts,
  profiles,
  isSubmitting,
  status = 'idle',
  errorMsg,
}: QuickAddAccountRowProps) {
  const notesRef = useRef<HTMLInputElement>(null)

  const set = useCallback(
    (field: keyof QuickAddRowData, value: string) => {
      onChange({ ...data, [field]: value })
    },
    [data, onChange]
  )

  // When Tab/Enter is pressed on the last field, add new row
  const handleLastFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      onAddNext()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onAddNext()
    }
  }

  // Escape anywhere on the row → delete it
  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onDelete()
    }
  }

  const getBrowserTypeLabel = (browserType: string | null | undefined) => {
    if (!browserType) return 'Unknown'
    const t = browserType.toLowerCase()
    if (t === 'chromium' || t === 'chrome') return 'Chrome'
    if (t === 'firefox') return 'Firefox'
    if (t === 'gpm') return 'GPM'
    return browserType
  }

  const rowBg =
    status === 'success'
      ? 'bg-green-50'
      : status === 'error'
      ? 'bg-red-50'
      : 'bg-yellow-50'

  const inputCls =
    'w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100 disabled:cursor-not-allowed'

  return (
    <tr className={`${rowBg} transition-colors`} onKeyDown={handleRowKeyDown}>
      {/* Row number */}
      <td className="px-2 py-1.5 text-xs text-gray-400 font-mono whitespace-nowrap border-b border-dashed border-gray-200 w-8">
        <div className="flex items-center gap-1">
          {status === 'success' && <span title="Saved">✅</span>}
          {status === 'error' && <span title={errorMsg}>❌</span>}
          {status === 'idle' && (
            <span className="text-gray-300 select-none">{rowIndex + 1}</span>
          )}
        </div>
      </td>

      {/* Account Type */}
      <td className="px-1 py-1.5 border-b border-dashed border-gray-200 w-28">
        <select
          disabled={isSubmitting || status === 'success'}
          value={data.accountType}
          onChange={(e) => set('accountType', e.target.value)}
          className={inputCls}
        >
          {accountTypes.map((t) => (
            <option key={t.id} value={t.name}>
              {t.icon ? `${t.icon} ` : ''}{t.label}
            </option>
          ))}
          <option value="custom">📋 Custom</option>
        </select>
      </td>

      {/* Login Method */}
      <td className="px-1 py-1.5 border-b border-dashed border-gray-200 w-28">
        <select
          disabled={isSubmitting || status === 'success'}
          value={data.loginMethod}
          onChange={(e) => set('loginMethod', e.target.value)}
          className={inputCls}
        >
          <option value="PASSWORD">Password</option>
          <option value="AUTHENTICATOR">Authenticator</option>
          <option value="GOOGLE_OAUTH">Google OAuth</option>
          <option value="X_OAUTH">X OAuth</option>
          <option value="DISCORD_OAUTH">Discord OAuth</option>
          <option value="CUSTOM">Custom</option>
        </select>
      </td>

      {/* Identifier */}
      <td className="px-1 py-1.5 border-b border-dashed border-gray-200 min-w-[160px]">
        <input
          type="text"
          disabled={isSubmitting || status === 'success'}
          value={data.identifier}
          onChange={(e) => set('identifier', e.target.value)}
          placeholder="user@example.com *"
          className={`${inputCls} ${!data.identifier && status === 'error' ? 'border-red-400 ring-1 ring-red-400' : ''}`}
          autoFocus={rowIndex === 0}
        />
        {status === 'error' && errorMsg && (
          <p className="text-[10px] text-red-600 mt-0.5 truncate" title={errorMsg}>
            {errorMsg}
          </p>
        )}
      </td>

      {/* Password */}
      <td className="px-1 py-1.5 border-b border-dashed border-gray-200 w-32">
        <input
          type="password"
          disabled={isSubmitting || status === 'success'}
          value={data.password}
          onChange={(e) => set('password', e.target.value)}
          placeholder="Password"
          className={inputCls}
        />
      </td>

      {/* 2FA */}
      <td className="px-1 py-1.5 border-b border-dashed border-gray-200 w-28">
        <input
          type="text"
          disabled={isSubmitting || status === 'success'}
          value={data.twoFactorSecret}
          onChange={(e) => set('twoFactorSecret', e.target.value)}
          placeholder="2FA Secret"
          className={inputCls}
        />
      </td>

      {/* Login via Account */}
      <td className="px-1 py-1.5 border-b border-dashed border-gray-200 w-44">
        <SearchableSelect
          disabled={isSubmitting || status === 'success'}
          value={data.authViaAccountId}
          onChange={(val) => {
            const parent = parentAccounts.find((a) => a.id === val)
            const updates: Partial<QuickAddRowData> = { authViaAccountId: val }
            if (parent) {
              if (!data.identifier) updates.identifier = parent.identifier
              if (parent.gpmloginProfileId)
                updates.gpmloginProfileId = parent.gpmloginProfileId
            }
            onChange({ ...data, ...updates })
          }}
          options={parentAccounts.map((a) => ({
            value: a.id,
            label: `${a.label} - ${a.identifier}`,
            sublabel: a.accountType,
          }))}
          placeholder="Search account..."
          emptyOption="-- None --"
        />
      </td>

      {/* Browser Profile */}
      <td className="px-1 py-1.5 border-b border-dashed border-gray-200 w-44">
        <SearchableSelect
          disabled={isSubmitting || status === 'success'}
          value={data.gpmloginProfileId}
          onChange={(val) => set('gpmloginProfileId', val)}
          options={profiles.map((p) => ({
            value: p.id,
            label: p.name,
            sublabel: `${p.profileUid} · ${getBrowserTypeLabel(p.browserType)}`,
          }))}
          placeholder="Search profile..."
          emptyOption="-- None --"
        />
      </td>

      {/* Notes — last tabbable field */}
      <td className="px-1 py-1.5 border-b border-dashed border-gray-200 min-w-[120px]">
        <input
          ref={notesRef}
          type="text"
          disabled={isSubmitting || status === 'success'}
          value={data.notes}
          onChange={(e) => set('notes', e.target.value)}
          onKeyDown={handleLastFieldKeyDown}
          placeholder="Notes (Tab/Enter → new row)"
          className={inputCls}
        />
      </td>

      {/* Row actions */}
      <td className="px-2 py-1.5 border-b border-dashed border-gray-200 whitespace-nowrap">
        {status !== 'success' && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onAddNext}
              disabled={isSubmitting}
              title="Add row below (Enter)"
              className="px-1.5 py-1 rounded text-xs text-blue-600 hover:bg-blue-100 disabled:opacity-40 transition-colors"
            >
              +
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isSubmitting}
              title="Remove row (Esc)"
              className="px-1.5 py-1 rounded text-xs text-red-500 hover:bg-red-100 disabled:opacity-40 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        {status === 'success' && (
          <span className="text-xs text-green-600 font-medium">Saved</span>
        )}
      </td>
    </tr>
  )
}
