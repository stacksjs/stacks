/**
 * API Composable
 *
 * Provides API utilities and configuration helpers.
 * The browser query builder is auto-configured via ../auto-init.ts
 * when @stacksjs/browser is imported, so manual initApi() is optional.
 *
 * Models are loaded dynamically via model-loader.ts - no hardcoded
 * model imports needed here.
 */

import { configureBrowser, browserAuth } from 'bun-query-builder'

/**
 * Initialize the API client with custom configuration
 *
 * NOTE: This is now OPTIONAL. The framework auto-initializes with
 * sensible defaults when @stacksjs/browser is imported.
 *
 * Only call this if you need custom configuration:
 * - Different API base URL
 * - Custom unauthorized handler
 * - Custom token retrieval
 *
 * @example
 * // Custom base URL
 * initApi({ baseUrl: 'https://api.example.com' })
 *
 * @example
 * // Custom unauthorized handler
 * initApi({
 *   onUnauthorized: () => showLoginModal()
 * })
 */
export function initApi(options?: {
  baseUrl?: string
  onUnauthorized?: () => void
}): void {
  const baseUrl = options?.baseUrl || (
    typeof window !== 'undefined'
      ? `${window.location.origin}/api`
      : 'http://localhost:3008/api'
  )

  configureBrowser({
    baseUrl,
    getToken: () => {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('token')
      }
      return null
    },
    onUnauthorized: options?.onUnauthorized || (() => {
      // Default: redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }),
    transformResponse: (data) => {
      // Handle Stacks API response format { data: ... }
      return data?.data ?? data
    },
  })
}

/**
 * Auth utilities
 */
export const auth = browserAuth

/**
 * Helper to format area size for display
 */
export function formatAreaSize(sqMeters: number): string {
  if (sqMeters >= 1000000) {
    return `${(sqMeters / 1000000).toFixed(2)} km²`
  }
  if (sqMeters >= 10000) {
    return `${(sqMeters / 10000).toFixed(2)} ha`
  }
  return `${sqMeters.toLocaleString()} m²`
}

/**
 * Helper to format distance for display
 */
export function formatDistance(miles: number): string {
  return `${miles.toFixed(1)} mi`
}

/**
 * Helper to format elevation for display
 */
export function formatElevation(feet: number): string {
  return `${feet.toLocaleString()} ft`
}

/**
 * Helper to format duration for display
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

/**
 * Helper to get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}

/**
 * Type-safe API fetch wrapper with error handling
 */
export async function fetchData<T>(
  fetcher: () => Promise<T>,
  options?: {
    onError?: (error: Error) => void
    fallback?: T
  }
): Promise<T | undefined> {
  try {
    return await fetcher()
  } catch (error) {
    if (options?.onError) {
      options.onError(error as Error)
    } else {
      console.error('API Error:', error)
    }
    return options?.fallback
  }
}
