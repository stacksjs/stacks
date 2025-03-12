import type { Err, Ok } from '@stacksjs/error-handling'
import type { Model } from '@stacksjs/types'
import { ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getModelName, getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { useSearchEngine } from '@stacksjs/search-engine'
import { globSync } from '@stacksjs/storage'

export async function flushModelDocuments(modelOption?: string): Promise<Ok<string, never> | Err<string, any>> {
  try {
    const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
    const { deleteIndex } = useSearchEngine()

    for (const model of modelFiles) {
      const modelInstance = (await import(model)).default as Model
      const searchable = modelInstance.traits?.useSearch

      const tableName = getTableName(modelInstance, model)
      const modelName = getModelName(modelInstance, model)

      if (modelOption && modelName !== modelOption)
        continue

      if (searchable && (typeof searchable === 'boolean' || typeof searchable === 'object'))
        await deleteIndex(tableName)
    }

    return ok('Successfully flushed all model data from search engine!')
  }
  catch (err: any) {
    log.error(err)

    return err(err)
  }
}
