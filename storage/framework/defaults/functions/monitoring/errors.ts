import { resolveApiBaseUrl } from '../api-url'
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
  error_ids: number[]
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
const errorStats = useStorage<ErrorStats | null>('error-stats', null)
const errorTimeline = useStorage<ErrorTimelinePoint[]>('error-timeline', [])

const baseURL = `${resolveApiBaseUrl()}/dashboard/monitoring`

export function errorGroupParams(type: string, message: string): URLSearchParams {
  return new URLSearchParams({ type, message })
}

/**
 * Fetch all grouped errors
 */
async function fetchGroupedErrors(): Promise<GroupedError[]> {
  try {
    const response = await fetch(`${baseURL}/errors`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: GroupedError[] }

    if (Array.isArray(data)) {
      groupedErrors.value = data
      return data
    }
    else {
      console.error('Expected array of errors but received:', typeof data)
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
    const response = await fetch(`${baseURL}/errors/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, message }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

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
    const response = await fetch(`${baseURL}/errors/ignore`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, message }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

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
    const response = await fetch(`${baseURL}/errors/unresolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, message }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

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
    const response = await fetch(`${baseURL}/errors?${errorGroupParams(type, message)}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

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
