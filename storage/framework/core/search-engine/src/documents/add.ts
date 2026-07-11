import type { Err, Ok } from '@stacksjs/error-handling'
import type { Model } from '@stacksjs/types'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getModelName, getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { useSearchEngine } from '@stacksjs/search-engine'
import { globSync } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'

export async function importModelDocuments(modelOption?: string): Promise<Ok<string, never> | Err<string, any>> {
  try {
    const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/app/Models/**/*.ts')], { absolute: true })
    const { addDocument, updateSettings } = useSearchEngine()

    for (const model of modelFiles) {
      const modelInstance = (await import(model)).default as Model
      const searchable = modelInstance.traits?.useSearch

      const tableName = getTableName(modelInstance, model)
      const modelName = getModelName(modelInstance, model)

      if (modelOption && modelName !== modelOption) continue

      if (searchable && (typeof searchable === 'boolean' || typeof searchable === 'object')) {
        if (typeof searchable === 'object') {
          await updateSettings(tableName, {
            searchableAttributes: (searchable.searchable ?? []).map(attr => snakeCase(attr)),
            filterableAttributes: (searchable.filterable ?? []).map(attr => snakeCase(attr)),
            sortableAttributes: (searchable.sortable ?? []).map(attr => snakeCase(attr)),
            displayedAttributes: (searchable.displayable ?? []).map(attr => snakeCase(attr)),
          })
        }

        type SearchableRow = { toSearchableObject?: () => Record<string, unknown> | null, id?: unknown }
        type QueryBuilder = {
          with: (...names: string[]) => QueryBuilder
          get: () => Promise<SearchableRow[]>
        }
        const ModelClass = modelInstance as typeof modelInstance & {
          all: () => Promise<SearchableRow[]>
          query?: () => QueryBuilder
        }

        if (typeof ModelClass.all !== 'function') {
          log.warn(`[search] ${modelName}: model has no .all() — run generate:model-files or use defineModel`)
          continue
        }

        // stacksjs/stacks#1918 — if the model declared `denormalize`
        // paths, eager-load the head segment of every path so the
        // synchronous `toSearchableObject()` can resolve them out of
        // `_relations` without a per-row round-trip. Falls back to
        // `.all()` when no denormalize map is set, when the model lacks
        // a `.query()` entry point, or when `.with(...).get()` fails
        // (the search index is best-effort; we'd rather index the rows
        // without the cross-table fields than skip the whole model).
        const denormalize = typeof searchable === 'object' ? searchable.denormalize : undefined
        const eagerRelations = denormalize
          ? Array.from(new Set(Object.values(denormalize).map(path => path.split('.')[0]).filter((path): path is string => Boolean(path))))
          : []

        let documents: SearchableRow[]
        if (eagerRelations.length > 0 && typeof ModelClass.query === 'function') {
          try {
            documents = await ModelClass.query().with(...eagerRelations).get()
          }
          catch (err) {
            log.warn(`[search] ${modelName}: eager-load of [${eagerRelations.join(', ')}] failed — falling back to .all(); denormalized fields will be null. (${(err as Error).message})`)
            documents = await ModelClass.all()
          }
        }
        else {
          documents = await ModelClass.all()
        }

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
