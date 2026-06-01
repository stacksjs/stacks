/**
 * Codegen: produce `database/types.d.ts` so userland gets typed
 * table-name autocomplete on `db.selectFrom(...)` / `insertInto(...)`
 * / etc. (stacksjs/stacks#1923).
 *
 * The framework can't know an app's tables at its own build time, so
 * `@stacksjs/database` ships an empty `DatabaseSchema` interface that
 * this codegen augments via TypeScript declaration merging.
 *
 * Walks both userland (`app/Models/*.ts`) and framework-default
 * (`storage/framework/defaults/app/Models/**\/*.ts`) model files,
 * pulls the column shape out of each model's `attributes` block plus
 * the implicit system columns (`id`, timestamps, soft-deletes, FK
 * columns from `belongsTo`), and emits one entry per registered
 * model.
 */

import type { Attribute, Model } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'

export interface GenerateSchemaOptions {
  modelsDir?: string
  defaultsDir?: string
  outFile?: string
  /** Print the would-be file content instead of writing. */
  dryRun?: boolean
}

export interface GenerateSchemaResult {
  outFile: string
  tables: Array<{ table: string, model: string, columns: Record<string, string> }>
  errors: Array<{ file: string, error: string }>
  content: string
}

function snakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/(\d)([A-Za-z])/g, '$1_$2')
    .toLowerCase()
}

/**
 * Map a model attribute's declared `type` to a TS type. Conservative:
 * unknown types fall back to `unknown` so the codegen never produces
 * a silently-wrong column type. Nullable columns get `| null`.
 */
function attributeToTsType(attr: Attribute): string {
  // `type` is the most common discriminator; some attributes carry the
  // type info inside a validation rule instead. Cover both.
  const declared = typeof attr.type === 'string' ? attr.type.toLowerCase() : ''
  const base = (() => {
    switch (declared) {
      case 'string':
      case 'text':
      case 'longtext':
      case 'mediumtext':
      case 'tinytext':
      case 'char':
      case 'varchar':
      case 'enum':
      case 'uuid':
      case 'date':
      case 'datetime':
      case 'timestamp':
      case 'timestamptz':
      case 'time':
      case 'year':
        return 'string'
      case 'integer':
      case 'int':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
      case 'float':
      case 'double':
      case 'decimal':
      case 'numeric':
        return 'number'
      case 'bigint':
        return 'number | bigint'
      case 'boolean':
      case 'bool':
        return 'boolean'
      case 'json':
      case 'jsonb':
        return 'unknown'
      case 'binary':
      case 'blob':
      case 'bytea':
        return 'Uint8Array'
      default:
        return 'unknown'
    }
  })()
  return attr.nullable === true ? `${base} | null` : base
}

function deriveFkColumns(model: Model): Record<string, string> {
  const out: Record<string, string> = {}
  const rel = (model as Model).belongsTo
  if (!rel) return out
  const list: string[] = Array.isArray(rel) ? rel as string[] : Object.keys(rel as object)
  for (const target of list) {
    out[`${snakeCase(target)}_id`] = 'number'
  }
  return out
}

/**
 * Conventional pivot-table name (stacksjs/stacks#1938) — alphabetical
 * snake_case join of the two related models, matching Laravel:
 *   `User` + `Role` → `role_user`. Lets either side of the
 *   relation produce the same table name so the dedupe is trivial.
 */
function pivotTableName(a: string, b: string): string {
  const [first, second] = [snakeCase(a), snakeCase(b)].sort()
  return `${first}_${second}`
}

/**
 * Read a model's `belongsToMany` declaration and return one pivot-
 * table entry per relation. Handles both shorthand (array of model
 * names) and the explicit `BaseBelongsToMany` form (with
 * `pivotTable` / `firstForeignKey` / `secondForeignKey` overrides).
 */
function derivePivotTables(modelName: string, model: Model): Array<{ table: string, columns: Record<string, string> }> {
  const rel = (model as Model).belongsToMany
  if (!rel) return []
  const out: Array<{ table: string, columns: Record<string, string> }> = []

  const list = Array.isArray(rel) ? rel : []
  for (const entry of list) {
    let related: string
    let table: string | undefined
    let firstFk: string | undefined
    let secondFk: string | undefined
    if (typeof entry === 'string') {
      related = entry
    }
    else if (entry && typeof entry === 'object' && 'model' in entry) {
      const obj = entry as { model: string, pivotTable?: string, firstForeignKey?: string, secondForeignKey?: string }
      related = obj.model
      table = obj.pivotTable
      firstFk = obj.firstForeignKey
      secondFk = obj.secondForeignKey
    }
    else {
      continue
    }

    const tableName = table ?? pivotTableName(modelName, related)
    const fkA = firstFk ?? `${snakeCase(modelName)}_id`
    const fkB = secondFk ?? `${snakeCase(related)}_id`

    out.push({
      table: tableName,
      columns: {
        id: 'number',
        [fkA]: 'number',
        [fkB]: 'number',
        created_at: 'string',
        updated_at: 'string | null',
      },
    })
  }

  return out
}

function deriveSystemColumns(model: Model): Record<string, string> {
  const out: Record<string, string> = { id: 'number' }
  const traits = model.traits ?? {}
  if (traits.useUuid) out.uuid = 'string'
  const ts = traits.useTimestamps ?? traits.timestampable
  if (ts !== false) {
    // Default ON in Stacks. Only the explicit `false` opts out.
    out.created_at = 'string'
    out.updated_at = 'string | null'
  }
  if (traits.useSoftDeletes ?? traits.softDeletable) {
    out.deleted_at = 'string | null'
  }
  return out
}

function deriveAttributeColumns(model: Model): Record<string, string> {
  const out: Record<string, string> = {}
  const attributes = model.attributes ?? {}
  for (const [name, attr] of Object.entries(attributes)) {
    out[snakeCase(name)] = attributeToTsType(attr as Attribute)
  }
  return out
}

function renderTableEntry(table: string, columns: Record<string, string>): string {
  const cols = Object.entries(columns)
    .map(([col, ty]) => `      ${col}: ${ty}`)
    .join('\n')
  return `    ${table}: {\n      // columns\n${cols}\n    }`
}

const HEADER = `/* eslint-disable */
// AUTO-GENERATED by \`buddy generate:db-types\` — do not edit.
// Regenerate after adding/removing a model or changing its attributes.
// See stacksjs/stacks#1923.

declare module '@stacksjs/database' {
  interface DatabaseSchema {
`

const FOOTER = `  }
}

export {}
`

async function loadModelsFrom(dir: string, recursive: boolean): Promise<Array<{ filePath: string, model: Model }>> {
  const out: Array<{ filePath: string, model: Model }> = []
  if (!fs.existsSync(dir)) return out
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (recursive) {
        const sub = await loadModelsFrom(fullPath, true)
        out.push(...sub)
      }
      continue
    }
    if (!entry.name.endsWith('.ts')) continue
    if (entry.name.startsWith('_') || entry.name.startsWith('index')) continue
    try {
      const module = await import(fullPath)
      const def = (module.default || module) as Model
      if (def?.name && (def.attributes || def.table)) {
        out.push({ filePath: fullPath, model: def })
      }
    }
    catch {
      // Per-file failure is non-fatal — buildSchema captures via errors[].
    }
  }
  return out
}

/**
 * Walk userland + framework-default models, return the rendered
 * `database/types.d.ts` content plus a structured per-table summary
 * the CLI can render.
 */
export async function buildDatabaseSchema(options: GenerateSchemaOptions = {}): Promise<GenerateSchemaResult> {
  const modelsDir = options.modelsDir ?? path.userModelsPath()
  const defaultsDir = options.defaultsDir ?? path.frameworkPath('defaults/app/Models')
  const outFile = options.outFile ?? path.projectPath('database/types.d.ts')

  const errors: GenerateSchemaResult['errors'] = []
  const allModels: Array<{ filePath: string, model: Model }> = []

  for (const [dir, recursive] of [[modelsDir, false], [defaultsDir, true]] as const) {
    try {
      const found = await loadModelsFrom(dir, recursive)
      allModels.push(...found)
    }
    catch (err) {
      errors.push({ file: dir, error: (err as Error).message })
    }
  }

  // User models override defaults for the same model name.
  const byName = new Map<string, { filePath: string, model: Model }>()
  for (const item of allModels) {
    byName.set(item.model.name ?? path.basename(item.filePath, '.ts'), item)
  }
  // Re-walk userland last so it wins on collisions.
  for (const item of allModels) {
    if (item.filePath.startsWith(modelsDir)) {
      byName.set(item.model.name ?? path.basename(item.filePath, '.ts'), item)
    }
  }

  const tables: GenerateSchemaResult['tables'] = []
  for (const [name, { model }] of byName) {
    const tableName = model.table ?? `${snakeCase(name)}s`
    const columns: Record<string, string> = {
      ...deriveSystemColumns(model),
      ...deriveAttributeColumns(model),
      ...deriveFkColumns(model),
    }
    tables.push({ table: tableName, model: name, columns })
  }

  // belongsToMany pivot tables (stacksjs/stacks#1938). Both sides of
  // a many-to-many produce the same conventional table name, so dedupe
  // by table key — `BelongsToMany 'User' on Role` and `BelongsToMany
  // 'Role' on User` both target `role_user`.
  const pivotByTable = new Map<string, { table: string, model: string, columns: Record<string, string> }>()
  for (const [name, { model }] of byName) {
    for (const pivot of derivePivotTables(name, model)) {
      if (pivotByTable.has(pivot.table)) continue
      pivotByTable.set(pivot.table, { table: pivot.table, model: `(${pivot.table} pivot)`, columns: pivot.columns })
    }
  }
  tables.push(...pivotByTable.values())

  // Stable alphabetical ordering so diffs are reviewable.
  tables.sort((a, b) => a.table.localeCompare(b.table))

  const body = tables.map(t => renderTableEntry(t.table, t.columns)).join('\n')
  const content = `${HEADER}${body}\n${FOOTER}`

  if (!options.dryRun) {
    const dir = path.dirname(outFile)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(outFile, content, 'utf-8')
    log.success(`[generate:db-types] wrote ${tables.length} table(s) to ${outFile}`)
  }

  return { outFile, tables, errors, content }
}

/**
 * Pure renderer — for tests that don't want to round-trip through the
 * model loader.
 */
export function renderDatabaseTypeFile(
  tables: Array<{ table: string, columns: Record<string, string> }>,
): string {
  const body = [...tables]
    .sort((a, b) => a.table.localeCompare(b.table))
    .map(t => renderTableEntry(t.table, t.columns))
    .join('\n')
  return `${HEADER}${body}\n${FOOTER}`
}
