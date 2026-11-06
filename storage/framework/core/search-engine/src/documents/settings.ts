import type {Result} from '@stacksjs/error-handling'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getTableName } from '@stacksjs/orm'
import { useSearchEngine } from '@stacksjs/search-engine'
import { selectedSearchModels } from './models'
import { searchIndexName, settingsFromSearchTrait } from './trait-settings'

export async function updateIndexSettings(modelOption?: string): Promise<Result<string, string>> {
  try {
    const models = await selectedSearchModels(modelOption)
    const { updateSettings } = useSearchEngine()

    for (const { file: model, model: modelInstance } of models) {
      const searchable = modelInstance.traits?.useSearch

      const tableName = searchIndexName(searchable, getTableName(modelInstance, model))

      if (searchable && typeof searchable === 'object') {
        // Displayed attributes are left to the import, as they always were here.
        await updateSettings(tableName, settingsFromSearchTrait(searchable, { displayed: false }))
      }
    }

    return ok('Successfully update index settings!')
  }
  catch (error: any) {
    log.error(error)

    return err(error?.message || String(error))
  }
}
