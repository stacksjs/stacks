import { resolveApiBaseUrl } from './api-url'

export interface SearchResultItem {
  id: string | number
  title: string
  subtitle?: string
  href: string
  icon: string
}

export interface SearchResults {
  [modelType: string]: SearchResultItem[]
}

export interface SearchUnavailable {
  model: string
  reason: string
}

export interface GlobalSearchResponse {
  results?: SearchResults
  unavailable?: SearchUnavailable[]
}

export interface LoadedGlobalSearch {
  results: SearchResults
  unavailable: SearchUnavailable[]
}

const baseUrl = resolveApiBaseUrl()

export async function fetchGlobalSearch(query: string, signal?: AbortSignal): Promise<LoadedGlobalSearch> {
  const response = await fetch(`${baseUrl}/dashboard/search?q=${encodeURIComponent(query)}`, {
    headers: { 'Accept': 'application/json' },
    signal,
  })

  if (!response.ok)
    throw new Error(`Dashboard search failed with status ${response.status}`)

  const data = await response.json() as GlobalSearchResponse
  return {
    results: data.results && typeof data.results === 'object' ? data.results : {},
    unavailable: Array.isArray(data.unavailable) ? data.unavailable : [],
  }
}
