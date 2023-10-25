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
  const offsetVal = ((params.page * params.perPage) - 20) || 0
  const filter = convertToMeilisearchFilter(params.filter)
  const sort = convertToMeilisearchSorting(params.sort)

  return await client()
    .index(index)
    .search(params.query, { limit: params.perPage, filter, sort, offset: offsetVal })
}

function convertToMeilisearchFilter(jsonData: any): string[] {
  const filters: string[] = [];

  for (const key in jsonData) {
    if (jsonData.hasOwnProperty(key)) {
      const value = jsonData[key];
      const filter = `${key}='${value}'`;
      filters.push(filter);
    }
  }

  return filters;
}

function convertToMeilisearchSorting(jsonData: any): string[] {
  const filters: string[] = [];

  for (const key in jsonData) {
    if (jsonData.hasOwnProperty(key)) {
      const value = jsonData[key];
      const filter = `${key}:${value}`;
      filters.push(filter);
    }
  }

  return filters;
}


export default {
  client,
  search,
  // ...other methods
} satisfies SearchEngineDriver
