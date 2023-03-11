import { MeiliSearch } from 'meilisearch'

export function useMeilisearch() {
  const host = import.meta.env.VITE_MEILISEARCH_HOST
  const apiKey = import.meta.env.VITE_MEILISEARCH_KEY

  return new MeiliSearch({ host, apiKey })
}
