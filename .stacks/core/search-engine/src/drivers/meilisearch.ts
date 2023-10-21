import { searchEngine } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import type { MeiliSearchOptions, SearchEngineDriver } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import type { SearchResponse } from 'meilisearch'
import { MeiliSearch } from 'meilisearch'
import process from 'node:process'

function client(options?: MeiliSearchOptions) {
  let host = searchEngine.meilisearch?.host
  let apiKey = searchEngine.meilisearch?.apiKey

  if (options?.host)
    host = options.host

  if (options?.apiKey)
    apiKey = options.apiKey

  if (!host) {
    log.error('Please specify a search engine host.')
    process.exit(ExitCode.FatalError)
  }

  return new MeiliSearch({ host, apiKey })
}

async function search(index: string, params: any): Promise<SearchResponse<Record<string, any>>> {
  return await client()
    .index(index)
    .search(params.query, { limit: params.perPage, offset: params.page * params.perPage })
}

export default {
  client,
  search,
  // ...other methods
} satisfies SearchEngineDriver
