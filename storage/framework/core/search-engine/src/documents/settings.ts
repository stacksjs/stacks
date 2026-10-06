import type {Result} from '@stacksjs/error-handling'
import type { Model } from '@stacksjs/types'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { useSearchEngine } from '@stacksjs/search-engine'
import { globSync } from '@stacksjs/storage'
import { settingsFromSearchTrait } from './trait-settings'

export async function updateIndexSettings(): Promise<Result<string, string>> {
  try {
    const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/app/Models/**/*.ts')], { absolute: true })
    const { updateSettings } = useSearchEngine()

    for (const model of modelFiles) {
      const modelInstance = (await import(model)).default as Model
      const searchable = modelInstance.traits?.useSearch

      const tableName = getTableName(modelInstance, model)

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
