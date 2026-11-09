import { resolveApiBaseUrl } from '../api-url'
import { dashboardApi } from '../dashboard-api'
import { useStorage } from '@stacksjs/browser/composables/useStorage'

export interface GroupedError {
  id: number
  type: string
  message: string
  stack: string | null
  status: string
  count: number
  first_seen: string
  last_seen: string
}

export interface ErrorRecord {
  id: number
  type: string
  message: string
  stack: string | null
  status: number | null
  additional_info: string | null
  created_at: string
  updated_at: string | null
}

export interface ErrorStats {
  total: number
  unresolved: number
  resolved: number
  ignored: number
  last_24h: number
  trend: number
}

export interface ErrorTimelinePoint {
  hour: string
  count: number
}

// The Errors page lists the groups itself, through useServerList
// (stacksjs/stacks#3195); these are the cards and the timeline.
const errorStats = useStorage<ErrorStats | null>('error-stats', null)
const errorTimeline = useStorage<ErrorTimelinePoint[]>('error-timeline', [])

const baseURL = `${resolveApiBaseUrl()}/dashboard/monitoring`

export function errorGroupParams(type: string, message: string): URLSearchParams {
  return new URLSearchParams({ type, message })
}

/** One page of error groups, and what the pager and the type filter need. */
export interface ErrorGroupPage {
  groups: GroupedError[]
  total: number
  page: number
  /** Every recorded type, for the filter: a page alone would list only its own. */
  types: string[]
}

/**
 * One page of grouped errors, searched, filtered, sorted and paged by the
 * server (stacksjs/stacks#3195), for the page's useServerList. It throws
 * when the groups cannot be read, so the page can say so: this used to log
 * to the console and leave the last list cached in localStorage on screen.
 */
export async function fetchErrorGroupPage(query: URLSearchParams): Promise<ErrorGroupPage> {
  const { data } = await dashboardApi<{ data?: Partial<ErrorGroupPage> }>(`${baseURL}/errors?${query}`)
  if (!data || !Array.isArray(data.groups))
    throw new TypeError('Error groups were not returned in the expected shape.')
  return {
    groups: data.groups,
    total: Number(data.total || 0),
    page: Number(data.page || 1),
    types: Array.isArray(data.types) ? data.types.map(String) : [],
  }
}

/**
 * Fetch a single error by ID
 */
async function fetchErrorById(id: number): Promise<ErrorRecord | null> {
  try {
    const response = await fetch(`${baseURL}/errors/${id}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: ErrorRecord }
    return data
  }
  catch (error) {
    console.error('Error fetching error by ID:', error)
    return null
  }
}

/**
 * Fetch all errors in a specific group
 */
async function fetchErrorGroup(type: string, message: string): Promise<ErrorRecord[]> {
  try {
    const response = await fetch(`${baseURL}/errors/group?${errorGroupParams(type, message)}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: ErrorRecord[] }
    return data || []
  }
  catch (error) {
    console.error('Error fetching error group:', error)
    return []
  }
}

/**
 * Fetch error statistics
 */
async function fetchErrorStats(): Promise<ErrorStats | null> {
  try {
    const response = await fetch(`${baseURL}/errors/stats`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: ErrorStats }
    errorStats.value = data
    return data
  }
  catch (error) {
    console.error('Error fetching error stats:', error)
    return errorStats.value
  }
}

/**
 * Fetch error timeline
 */
async function fetchErrorTimeline(): Promise<ErrorTimelinePoint[]> {
  try {
    const response = await fetch(`${baseURL}/errors/timeline`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: ErrorTimelinePoint[] }
    errorTimeline.value = data
    return data
  }
  catch (error) {
    console.error('Error fetching error timeline:', error)
    return errorTimeline.value
  }
}

/**
 * Resolve all errors in a group
 */
async function resolveErrorGroup(type: string, message: string): Promise<boolean> {
  try {
    // Through dashboardApi, which sends the CSRF token: a bare fetch was
    // refused with 403, so every resolve from this page did nothing
    // (stacksjs/stacks#3194).
    await dashboardApi(`${baseURL}/errors/resolve`, { method: 'PATCH', body: { type, message } })

    return true
  }
  catch (error) {
    console.error('Error resolving error group:', error)
    return false
  }
}

/**
 * Ignore all errors in a group
 */
async function ignoreErrorGroup(type: string, message: string): Promise<boolean> {
  try {
    // Through dashboardApi, which sends the CSRF token: a bare fetch was
    // refused with 403, so every ignore from this page did nothing
    // (stacksjs/stacks#3194).
    await dashboardApi(`${baseURL}/errors/ignore`, { method: 'PATCH', body: { type, message } })

    return true
  }
  catch (error) {
    console.error('Error ignoring error group:', error)
    return false
  }
}

/**
 * Unresolve (reopen) all errors in a group
 */
async function unresolveErrorGroup(type: string, message: string): Promise<boolean> {
  try {
    // Through dashboardApi, which sends the CSRF token: a bare fetch was
    // refused with 403, so every unresolve from this page did nothing
    // (stacksjs/stacks#3194).
    await dashboardApi(`${baseURL}/errors/unresolve`, { method: 'PATCH', body: { type, message } })

    return true
  }
  catch (error) {
    console.error('Error unresolving error group:', error)
    return false
  }
}

/**
 * Delete all errors in a group
 */
async function deleteErrorGroup(type: string, message: string): Promise<boolean> {
  try {
    // Through dashboardApi for the CSRF token, as the triage writes above.
    await dashboardApi(`${baseURL}/errors?${errorGroupParams(type, message)}`, { method: 'DELETE' })

    return true
  }
  catch (error) {
    console.error('Error deleting error group:', error)
    return false
  }
}

export function useErrors() {
  return {
    errorStats,
    errorTimeline,
    fetchErrorById,
    fetchErrorGroup,
    fetchErrorStats,
    fetchErrorTimeline,
    resolveErrorGroup,
    ignoreErrorGroup,
    unresolveErrorGroup,
    deleteErrorGroup,
  }
}
