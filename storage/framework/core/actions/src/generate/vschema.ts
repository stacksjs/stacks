/**
 * `buddy generate:vschema` — derive a Vitess keyspace VSchema from models.
 *
 * The derivation itself lives in `@stacksjs/database` (`./vschema`) and is
 * pure. This file is the I/O half: find the models, import them, hand the
 * definitions over, and write the result.
 *
 * Models are collected through `resolveModelSources`, the same helper the
 * migration generator uses, so a VSchema covers exactly the tables the
 * migrations create — including the framework's own models and the nested
 * ones under `commerce/`, `Content/`, etc. Reading only `app/Models` would
 * silently emit a VSchema missing most of the schema, and a table absent
 * from a VSchema is not a warning at query time: vtgate refuses to route to
 * it at all.
 */

import { dirname } from 'node:path'
import { deriveVSchema, formatShardingReport, resolveModelSources, toShardableModel } from '@stacksjs/database'
import type { ShardableModel, VSchema } from '@stacksjs/database'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'

export interface GenerateVSchemaOptions {
  /** Print instead of writing. */
  dryRun?: boolean
  /** Output path, relative to the project root. */
  out?: string
}

export type GenerateVSchemaResult =
  | { ok: false, error: string }
  | { ok: true, vschema: VSchema, report: string, path: string, tableCount: number }

/**
 * Resolve a model file's table name.
 *
 * Mirrors the framework convention: an explicit `table` wins, otherwise the
 * model name is pluralized. Kept local and deliberately simple rather than
 * reaching for the ORM's resolver, which needs a configured database
 * connection this command has no reason to open.
 */
function tableNameFor(definition: any, fileName: string): string {
  if (definition?.table)
    return definition.table

  const name: string = definition?.name ?? fileName
  const snake = name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()

  // Enough pluralization for table naming; a model whose plural this gets
  // wrong should set `table` explicitly, which is already the convention.
  if (/(?:s|x|z|ch|sh)$/.test(snake))
    return `${snake}es`
  if (/[^aeiou]y$/.test(snake))
    return `${snake.slice(0, -1)}ies`
  return `${snake}s`
}

export async function generateVSchema(options: GenerateVSchemaOptions = {}): Promise<GenerateVSchemaResult> {
  const sources = resolveModelSources()
  if (!sources || sources.models.length === 0)
    return { ok: false, error: 'No models found. A VSchema is derived from your models, so there is nothing to generate.' }

  const models: ShardableModel[] = []
  const failed: string[] = []

  for (const source of sources.models) {
    try {
      const definition = (await import(source.file)).default
      if (!definition)
        continue
      models.push(toShardableModel(definition, tableNameFor(definition, source.name)))
    }
    catch (error) {
      // One unreadable model must not sink the whole command, but it also
      // must not silently vanish — a missing table is a routing failure at
      // runtime, not a warning.
      failed.push(`${source.name}: ${(error as Error).message}`)
    }
  }

  for (const failure of failed)
    log.warn(`[generate:vschema] skipped ${failure}`)

  if (models.length === 0)
    return { ok: false, error: 'Every model failed to load; nothing to derive a VSchema from.' }

  const { vschema, decisions } = deriveVSchema(models)
  const report = formatShardingReport(decisions)
  const outPath = path.projectPath(options.out ?? 'database/vschema.json')

  if (!options.dryRun) {
    fs.mkdirSync(dirname(outPath), { recursive: true })
    await Bun.write(outPath, `${JSON.stringify(vschema, null, 2)}\n`)
  }

  return {
    ok: true,
    vschema,
    report,
    path: outPath,
    tableCount: Object.keys(vschema.tables).length,
  }
}
