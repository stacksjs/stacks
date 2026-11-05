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

/** What a page of groups asks for; every field may be left out. */
export interface ErrorGroupQuery {
  page?: number
  perPage?: number
  search?: string
  status?: string
  type?: string
  sort?: string
  direction?: 'asc' | 'desc'
}

/** The page the groups are, and what the pager and the type filter need. */
export interface ErrorGroupPageInfo {
  total: number
  page: number
  types: string[]
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

// Create persistent storage for errors data
const groupedErrors = useStorage<GroupedError[]>('grouped-errors', [])
// Only the newest page request may land: typing, paging and filtering can
// each start one while another is still out.
let groupRequestId = 0
const groupedErrorsPage = useStorage<ErrorGroupPageInfo>('grouped-errors-page', { total: 0, page: 1, types: [] })
const errorStats = useStorage<ErrorStats | null>('error-stats', null)
const errorTimeline = useStorage<ErrorTimelinePoint[]>('error-timeline', [])

const baseURL = `${resolveApiBaseUrl()}/dashboard/monitoring`

export function errorGroupParams(type: string, message: string): URLSearchParams {
  return new URLSearchParams({ type, message })
}

/** The page query as URL parameters, leaving out what is empty. */
export function errorGroupPageParams(query: ErrorGroupQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.page)
    params.set('page', String(query.page))
  if (query.perPage)
    params.set('per_page', String(query.perPage))
  if (query.search)
    params.set('search', query.search)
  if (query.status)
    params.set('status', query.status)
  if (query.type)
    params.set('type', query.type)
  if (query.sort) {
    params.set('sort', query.sort)
    params.set('direction', query.direction ?? 'asc')
  }
  return params
}

/**
 * Fetch one page of grouped errors. The server searches, filters, sorts and
 * pages them (stacksjs/stacks#3195); this keeps the page and what the pager
 * and the type filter need.
 */
async function fetchGroupedErrors(query: ErrorGroupQuery = {}): Promise<GroupedError[]> {
  const requestId = ++groupRequestId
  try {
    const params = errorGroupPageParams(query).toString()
    const response = await fetch(`${baseURL}/errors${params ? `?${params}` : ''}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: { groups?: GroupedError[], total?: number, page?: number, types?: string[] } }
    if (requestId !== groupRequestId)
      return groupedErrors.value

    if (data && Array.isArray(data.groups)) {
      groupedErrors.value = data.groups
      groupedErrorsPage.value = {
        total: Number(data.total || 0),
        page: Number(data.page || 1),
        types: Array.isArray(data.types) ? data.types.map(String) : [],
      }
      return data.groups
    }
    else {
      console.error('Expected a page of error groups but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching grouped errors:', error)
    return groupedErrors.value
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

    // Update local state
    const group = groupedErrors.value.find(
      e => e.type === type && e.message === message,
    )
    if (group)
      group.status = 'resolved'

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

    // Update local state
    const group = groupedErrors.value.find(
      e => e.type === type && e.message === message,
    )
    if (group)
      group.status = 'ignored'

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

    // Update local state
    const group = groupedErrors.value.find(
      e => e.type === type && e.message === message,
    )
    if (group)
      group.status = 'unresolved'

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

    // Update local state
    groupedErrors.value = groupedErrors.value.filter(
      e => !(e.type === type && e.message === message),
    )

    return true
  }
  catch (error) {
    console.error('Error deleting error group:', error)
    return false
  }
}

export function useErrors() {
  return {
    groupedErrors,
    groupedErrorsPage,
    errorStats,
    errorTimeline,
    fetchGroupedErrors,
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
