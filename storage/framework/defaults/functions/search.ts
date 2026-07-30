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

interface SearchResponse {
  results?: SearchResults
}

const baseUrl = resolveApiBaseUrl()

export async function fetchGlobalSearch(query: string, signal?: AbortSignal): Promise<SearchResults> {
  const response = await fetch(`${baseUrl}/dashboard/search?q=${encodeURIComponent(query)}`, {
    headers: { 'Accept': 'application/json' },
    signal,
  })

  if (!response.ok)
    throw new Error(`Dashboard search failed with status ${response.status}`)

  const data = await response.json() as SearchResponse
  return data.results || {}
}
