import { client } from './drivers/meilisearch'

export function useSearchEngine() {
  return client
}

export default {
  useSearchEngine,
  client,
}
