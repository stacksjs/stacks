import type { Err, Ok } from '@stacksjs/error-handling'
import type { Model } from '@stacksjs/types'
import { ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getModelName, getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { useSearchEngine } from '@stacksjs/search-engine'
import { globSync } from '@stacksjs/storage'

export async function importModelDocuments(modelOption?: string): Promise<Ok<string, never> | Err<string, any>> {
  try {
    const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
    const { addDocument } = useSearchEngine()

    for (const model of modelFiles) {
      const modelInstance = (await import(model)).default as Model
      const searchable = modelInstance.traits?.useSearch

      const tableName = getTableName(modelInstance, model)
      const modelName = getModelName(modelInstance, model)

      if (searchable && (typeof searchable === 'boolean' || typeof searchable === 'object')) {
        const ormModelPath = path.storagePath(`framework/orm/src/models/${modelName}.ts`)

        const ormModelInstance = (await import(ormModelPath)).default

        const documents = await ormModelInstance.all()

        for (const document of documents) {
          await addDocument(tableName, document.toSearchableObject())
        }
      }
    }

    log.info(modelOption)
    return ok('Successfully imported models to search engine!')
  }
  catch (err: any) {
    log.error(err)

    return err(err)
  }
}
