'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export interface SearchableSelectOption {
  value: string
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  emptyOption?: string
  className?: string
  disabled?: boolean
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Search...',
  emptyOption = '-- None --',
  className = '',
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  // Find the display label for the current value
  const selectedOption = options.find((o) => o.value === value)
  const displayValue = value === '' ? '' : selectedOption ? selectedOption.label : value

  const filteredOptions = options.filter((opt) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      opt.label.toLowerCase().includes(searchLower) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(searchLower))
    )
  })

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setHighlightedIndex(-1)
    }
  }, [isOpen])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li[data-idx]')
      const item = items[highlightedIndex] as HTMLElement
      if (item) {
        item.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue)
      setIsOpen(false)
      setSearch('')
    },
    [onChange]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    // Total items = emptyOption + filteredOptions
    const totalItems = 1 + filteredOptions.length

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % totalItems)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex === 0) {
        handleSelect('')
      } else if (highlightedIndex > 0) {
        handleSelect(filteredOptions[highlightedIndex - 1].value)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setSearch('')
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev)
        }}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-left shadow-sm focus:outline-none focus:ring-1 transition-colors ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
        style={{
          borderColor: 'var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
        }}
      >
        <span className={`truncate text-sm ${!value ? '' : ''}`} style={{ color: !value ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          {value === '' ? emptyOption : displayValue || value}
        </span>
        <svg
          className={`ml-2 h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md shadow-lg"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setHighlightedIndex(-1)
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full rounded border border-gray-200 py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <ul ref={listRef} className="max-h-52 overflow-y-auto py-1 text-sm">
            {/* Empty/None option */}
            <li
              data-idx="0"
              onClick={() => handleSelect('')}
              className={`cursor-pointer px-3 py-2 text-gray-500 hover:bg-blue-50 hover:text-blue-700 ${
                highlightedIndex === 0 ? 'bg-blue-50 text-blue-700' : ''
              } ${value === '' ? 'font-semibold text-blue-600' : ''}`}
            >
              {emptyOption}
            </li>

            {filteredOptions.length === 0 ? (
              <li className="px-3 py-3 text-center text-gray-400 text-xs">No results found</li>
            ) : (
              filteredOptions.map((opt, idx) => (
                <li
                  key={opt.value}
                  data-idx={idx + 1}
                  onClick={() => handleSelect(opt.value)}
                  className={`cursor-pointer px-3 py-2 hover:bg-blue-50 hover:text-blue-700 ${
                    highlightedIndex === idx + 1 ? 'bg-blue-50 text-blue-700' : ''
                  } ${value === opt.value ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-900'}`}
                >
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-gray-400 mt-0.5">{opt.sublabel}</span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>

          {/* Count footer */}
          <div className="border-t border-gray-100 px-3 py-1.5 text-xs text-gray-400">
            {search
              ? `${filteredOptions.length} / ${options.length} results`
              : `${options.length} items`}
          </div>
        </div>
      )}
    </div>
  )
}
