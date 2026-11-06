import { searchIndexName } from './trait-settings'
import type {Result} from '@stacksjs/error-handling'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getTableName, getModelName } from '@stacksjs/orm'
import { selectedSearchModels } from './models'
import { useSearchEngine } from '@stacksjs/search-engine'

export async function listIndexSettings(modelName?: string): Promise<Result<string, string>> {
  try {
    const { getFilterableAttributes, getSortableAttributes, getSearchableAttributes, getDisplayedAttributes } = useSearchEngine()
    for (const { file: modelFile, model: modelInstance } of await selectedSearchModels(modelName)) {
    const searchable = modelInstance.traits?.useSearch

    const tableName = searchIndexName(searchable, getTableName(modelInstance, modelFile))

    if (searchable && typeof searchable === 'object') {
      const displayedAttributes = await getDisplayedAttributes(tableName)
      const filterableAttributes = await getFilterableAttributes(tableName)
      const sortableAttributes = await getSortableAttributes(tableName)
      const searchableAttributes = await getSearchableAttributes(tableName)

      // eslint-disable-next-line no-console
      console.table({ model: getModelName(modelInstance, modelFile), index: tableName, displayedAttributes, filterableAttributes, sortableAttributes, searchableAttributes })
    }
    }

    return ok('Successfully update index settings!')
  }
  catch (error) {
    // The catch variable was named `err`, hiding the `err` helper, so this
    // called the caught Error as a function and threw a TypeError in place of
    // returning the failure.
    log.error(error)

    return err(error instanceof Error ? error.message : String(error))
  }
}
