import type { Model } from '@stacksjs/types'
import { type Err, ok, type Ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { useSearchEngine } from '@stacksjs/search-engine'
import { globSync } from '@stacksjs/storage'

export async function updateIndexSettings(): Promise<Ok<string, never> | Err<string, any>> {
  try {
    const userModelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })
    const { updateSettings } = useSearchEngine()

    for (const model of userModelFiles) {
      const modelInstance = (await import(model)).default as Model
      const searchable = modelInstance.traits?.useSearch

      const tableName = getTableName(modelInstance, model)

      if (searchable && typeof searchable === 'object') {
        const filterableAttributes = (typeof modelInstance.traits?.useSearch === 'object' && modelInstance.traits?.useSearch.filterable) || []
        const sortableAttributes = (typeof modelInstance.traits?.useSearch === 'object' && modelInstance.traits?.useSearch.sortable) || []
        const searchableAttributes = (typeof modelInstance.traits?.useSearch === 'object' && modelInstance.traits?.useSearch.searchable) || []

        await updateSettings(tableName, { filterableAttributes, sortableAttributes, searchableAttributes })
      }
    }

    return ok('Successfully update index settings!')
  }
  catch (err: any) {
    log.error(err)

    return err(err)
  }
}
