import { client } from './drivers/meilisearch'

export function useSearchEngine() {
  return client
}
