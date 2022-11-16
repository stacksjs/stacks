import { MeiliSearch } from 'meilisearch'

function client() {
  return new MeiliSearch({
    host: 'http://127.0.0.1:7700',
    apiKey: 'masterKey',
  })
}

export { client }
