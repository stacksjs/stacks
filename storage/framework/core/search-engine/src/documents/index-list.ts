import type {Result} from '@stacksjs/error-handling'
import type { Model } from '@stacksjs/types'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { useSearchEngine } from '@stacksjs/search-engine'

export async function listIndexSettings(modelName: string): Promise<Result<string, string>> {
  try {
    const modelFile = path.userModelsPath(`${modelName}.ts`)
    const modelInstance = (await import(modelFile)).default as Model
    const { getFilterableAttributes, getSortableAttributes, getSearchableAttributes, getDisplayedAttributes } = useSearchEngine()

    const searchable = modelInstance.traits?.useSearch

    const tableName = getTableName(modelInstance, modelFile)

    if (searchable && typeof searchable === 'object') {
      const displayedAttributes = await getDisplayedAttributes(tableName)
      const filterableAttributes = await getFilterableAttributes(tableName)
      const sortableAttributes = await getSortableAttributes(tableName)
      const searchableAttributes = await getSearchableAttributes(tableName)

      // eslint-disable-next-line no-console
      console.table({ displayedAttributes, filterableAttributes, sortableAttributes, searchableAttributes })
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
