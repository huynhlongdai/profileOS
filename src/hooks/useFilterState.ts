'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Custom hook to manage filter state with localStorage persistence
 * @param storageKey - Unique key for localStorage
 * @param defaultFilters - Default filter values
 * @returns Filter state and update functions
 */
export function useFilterState<T extends Record<string, any>>(
  storageKey: string,
  defaultFilters: T
) {
  // BUG-6 FIX: Lưu defaultFilters ban đầu trong ref, tránh re-create callbacks 
  // mỗi lần parent component re-render (vì object literal tạo mới mỗi lần)
  const defaultFiltersRef = useRef<T>(defaultFilters)

  // Initialize state from localStorage or defaults
  const [filters, setFilters] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultFiltersRef.current
    }

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to handle new filter fields
        // But preserve empty strings and other falsy values from stored data
        const merged = { ...defaultFiltersRef.current }
        for (const key in parsed) {
          // Preserve all values including empty strings, null, false, etc.
          merged[key as keyof T] = parsed[key]
        }
        return merged
      }
    } catch (error) {
      console.error(`Error loading filters from localStorage for ${storageKey}:`, error)
    }

    return defaultFiltersRef.current
  })

  // Save to localStorage whenever filters change
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(storageKey, JSON.stringify(filters))
    } catch (error) {
      console.error(`Error saving filters to localStorage for ${storageKey}:`, error)
    }
  }, [storageKey, filters])

  // Update a single filter
  const updateFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  // Update multiple filters at once
  const updateFilters = useCallback((newFilters: Partial<T>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }))
  }, [])

  // BUG-6 FIX: dùng ref thay vì closure trực tiếp → stable callback
  const resetFilters = useCallback(() => {
    setFilters(defaultFiltersRef.current)
    try {
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.error(`Error removing filters from localStorage for ${storageKey}:`, error)
    }
  }, [storageKey])

  // BUG-6 FIX: dùng ref thay vì closure trực tiếp → stable callback
  const clearFilter = useCallback(<K extends keyof T>(key: K) => {
    setFilters((prev) => ({
      ...prev,
      [key]: defaultFiltersRef.current[key],
    }))
  }, [])

  return {
    filters,
    setFilters,
    updateFilter,
    updateFilters,
    resetFilters,
    clearFilter,
  }
}
