import { searchIndexName } from './trait-settings'
import type {Result} from '@stacksjs/error-handling'
import type { Model } from '@stacksjs/types'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getModelName, getTableName } from '@stacksjs/orm'
import { useSearchEngine } from '@stacksjs/search-engine'
import { searchModelFiles } from './models'

export async function flushModelDocuments(modelOption?: string): Promise<Result<string, string>> {
  try {
    const modelFiles = await searchModelFiles()
    const { deleteIndex } = useSearchEngine()

    for (const model of modelFiles) {
      const modelInstance = (await import(model)).default as Model
      const searchable = modelInstance.traits?.useSearch

      const tableName = searchIndexName(searchable, getTableName(modelInstance, model))
      const modelName = getModelName(modelInstance, model)

      if (modelOption && modelName !== modelOption)
        continue

      if (searchable && (typeof searchable === 'boolean' || typeof searchable === 'object'))
        await deleteIndex(tableName)
    }

    return ok('Successfully flushed all model data from search engine!')
  }
  catch (error) {
    // The catch variable was named `err`, hiding the `err` helper, so this
    // called the caught Error as a function and threw a TypeError in place of
    // returning the failure.
    log.error(error)

    return err(error instanceof Error ? error.message : String(error))
  }
}
