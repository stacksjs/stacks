import type { Err, Ok } from '@stacksjs/error-handling'
import type { Model } from '@stacksjs/types'
import { ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { useSearchEngine } from '@stacksjs/search-engine'
import { globSync } from '@stacksjs/storage'

export async function updateIndexSettings(): Promise<Ok<string, never> | Err<string, any>> {
  try {
    const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
    const { updateSettings } = useSearchEngine()

    for (const model of modelFiles) {
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
