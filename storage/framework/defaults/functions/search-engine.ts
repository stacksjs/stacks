import { dashboardApi } from './dashboard-api'

export interface SearchEngineInventory {
  driver: string
  connected: boolean
  unavailable: string | null
  indexes: Array<{ name: string, documents: number | null }>
  models: Array<{ name: string, index: string, searchable: string[], filterable: string[], sortable: string[], displayed: string[] }>
}

export async function fetchSearchEngineInventory(): Promise<SearchEngineInventory> {
  return dashboardApi<SearchEngineInventory>('/api/dashboard/search-engine')
}
