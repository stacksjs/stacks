import { pathToFileURL } from 'node:url'
import type { ModelSource } from './model-sources'

/** Deliberately reviewed allowlist. Extension names are never interpolated from arbitrary config. */
export type ModelDatabaseExtension = 'vector'
const extensionSql: Record<ModelDatabaseExtension, string> = { vector: 'CREATE EXTENSION IF NOT EXISTS vector' }

export function databaseExtensionStatements(definitions: unknown[], dialect: string): string[] {
  const requested = new Set<ModelDatabaseExtension>()
  for (const value of definitions) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue
    const exported = value as Record<PropertyKey, unknown>
    const original = exported[Symbol.for('stacks.orm.modelDefinition')] ?? exported
    const declarations = (original as { databaseExtensions?: unknown }).databaseExtensions
    if (declarations === undefined) continue
    if (!Array.isArray(declarations)) throw new TypeError('Model databaseExtensions must be an array')
    for (const extension of declarations) {
      if (extension !== 'vector') throw new TypeError(`Unsupported model database extension: ${String(extension)}`)
      requested.add(extension)
    }
  }
  // SQLite uses the same JSON/text schema with lexical retrieval. It never claims pgvector support.
  return dialect === 'postgres' ? [...requested].sort().map(extension => extensionSql[extension]) : []
}

export async function modelDatabaseExtensionStatements(models: ModelSource[], dialect: string): Promise<string[]> {
  const definitions = []
  for (const model of models) definitions.push((await import(pathToFileURL(model.file).href)).default)
  return databaseExtensionStatements(definitions, dialect)
}
