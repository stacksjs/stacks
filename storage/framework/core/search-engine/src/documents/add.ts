import type { Err, Ok } from '@stacksjs/error-handling'
import type { Model } from '@stacksjs/types'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getModelName, getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { useSearchEngine } from '@stacksjs/search-engine'
import { globSync } from '@stacksjs/storage'

export async function importModelDocuments(modelOption?: string): Promise<Ok<string, never> | Err<string, any>> {
  try {
    const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/app/Models/**/*.ts')], { absolute: true })
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

        // Per-document try/catch so one bad row doesn't abort the entire
        // re-index. The previous behavior was: hit a malformed
        // toSearchableObject() return value, throw out of the inner loop,
        // and skip every remaining model. Now we count and report skipped
        // rows so operators know what didn't make it.
        let imported = 0
        let skipped = 0
        for (const document of documents) {
          try {
            const searchable = document.toSearchableObject?.()
            if (searchable == null) { skipped++; continue }
            await addDocument(tableName, searchable)
            imported++
          }
          catch (err) {
            skipped++
            log.warn(`[search] Skipped ${modelName}#${document.id ?? '?'}: ${(err as Error).message}`)
          }
        }
        log.info(`[search] ${modelName}: imported ${imported}, skipped ${skipped}`)
      }
    }

    log.info(modelOption)
    return ok('Successfully imported models to search engine!') as any
  }
  catch (error: any) {
    log.error(error)

    return err(error?.message || String(error)) as any
  }
}
