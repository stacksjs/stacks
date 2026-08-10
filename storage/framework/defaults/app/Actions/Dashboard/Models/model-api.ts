export const DEFAULT_MODEL_API_ROUTES = ['index', 'show', 'store', 'update', 'destroy'] as const

export interface ModelApiConfiguration {
  uri: string
  routes: string[]
}

/**
 * Normalize a model's useApi trait exactly as the ORM route generator does.
 * An enabled trait without explicit routes receives the complete REST set,
 * while an explicit empty routes array remains intentionally empty.
 */
export function modelApiConfiguration(Model: any): ModelApiConfiguration {
  const useApi = Model?.traits?.useApi
  if (!useApi)
    return { uri: '', routes: [] }

  const config = typeof useApi === 'object' ? useApi : {}
  const fallbackUri = String(Model?.table || `${String(Model?.name || '').toLowerCase()}s`)

  return {
    uri: String(config.uri || fallbackUri),
    routes: Array.isArray(config.routes)
      ? config.routes.map(String)
      : [...DEFAULT_MODEL_API_ROUTES],
  }
}
