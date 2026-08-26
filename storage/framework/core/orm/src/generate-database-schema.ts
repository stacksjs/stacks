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
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'

/**
 * What a boolean column reads back as, per dialect.
 *
 * `DatabaseSchema` types the RAW query builder - `db.selectFrom('events')` -
 * and a raw row is whatever the driver hands back, not what the model meant.
 * SQLite has no boolean type and stores 0/1 in an INTEGER; MySQL's BOOLEAN is
 * a TINYINT(1) and reads back the same way. Only Postgres answers a real
 * boolean.
 *
 * Emitting `boolean` everywhere made every flag column *almost* right: it
 * typechecks, and then `row.all_day === true` is false on a row whose flag is
 * set, which is the failure this exists to prevent.
 *
 * The ORM is unaffected - a model row goes through the attribute casts, so
 * `ModelRow<typeof Event>` keeps its `boolean`.
 */
type Dialect = 'sqlite' | 'mysql' | 'postgres'

function resolveDialect(explicit?: Dialect): Dialect {
  if (explicit)
    return explicit

  // The same signal `@stacksjs/orm` derives its own connection from, so the
  // generated types and the running query builder cannot disagree.
  const configured = String(process.env.DB_CONNECTION ?? '').toLowerCase()

  return configured === 'postgres' || configured === 'mysql' ? configured : 'sqlite'
}

function booleanType(dialect: Dialect): string {
  return dialect === 'postgres' ? 'boolean' : 'number'
}

export interface GenerateSchemaOptions {
  modelsDir?: string
  defaultsDir?: string
  outFile?: string
  /** Print the would-be file content instead of writing. */
  dryRun?: boolean
  /**
   * Which shape to write: an app's `DatabaseSchema` augmentation, or the
   * framework's own `FrameworkSchema`.
   */
  target?: SchemaTarget
  /**
   * Which database the generated rows describe. Defaults to `DB_CONNECTION`,
   * falling back to sqlite - the same resolution the query builder uses - so
   * the types match the driver that will actually answer the query.
   */
  dialect?: 'sqlite' | 'mysql' | 'postgres'
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
    // Deliberately no `(\d)([A-Za-z])` rule. A digit followed by a lowercase
    // letter is not a word boundary: `p256dh` is one token and splitting it
    // yields `p256_dh`, a column name nothing else in the framework derives.
    // `sha256Sum` still splits correctly, on the uppercase rule above, which is
    // the only place a boundary actually is. This matches snakeCase in
    // `@stacksjs/strings`; the two disagreeing is how the generated types and
    // the generated SQL end up naming the same column differently.
    .toLowerCase()
}

/**
 * The last hint: what a literal `default` is.
 *
 * An attribute with `default: false` and no rule is a boolean whatever else is
 * missing, and one with `default: 0` is a number. Only literals count - a
 * function default is computed at runtime and says nothing here.
 */
function fromDefault(attr: Attribute, dialect: Dialect): string {
  const value = (attr as { default?: unknown }).default

  if (typeof value === 'boolean')
    return booleanType(dialect)

  if (typeof value === 'number')
    return 'number'

  if (typeof value === 'string')
    return 'string'

  return 'unknown'
}

/**
 * What a validation rule says its own type is.
 *
 * Every rule `@stacksjs/validation` builds carries `name` - `'string'`,
 * `'number'`, `'boolean'`, `'enum'`, ... - and an enum carries its
 * `allowedValues` with it. That is the discriminator almost every real model
 * has, because a `defineModel()` attribute declares
 * `validation: { rule: schema.string() }` and hardly ever a bare `type`.
 *
 * Reading only `type` was why this codegen emitted `unknown` for nearly every
 * column in a real application: the information was one field away, and a
 * generated row type of `unknown` is a row type every call site replaces with
 * `any`.
 */
interface ValidationRuleShape {
  name?: unknown
  allowedValues?: unknown
}

function ruleOf(attr: Attribute): ValidationRuleShape | null {
  const validation = (attr as { validation?: { rule?: unknown } }).validation

  if (!validation || typeof validation !== 'object')
    return null

  const rule = (validation as { rule?: unknown }).rule

  return rule && typeof rule === 'object' ? rule as ValidationRuleShape : null
}

/** `'draft' | 'published'` for an enum rule, or null when it is not one. */
function enumUnion(rule: ValidationRuleShape | null): string | null {
  if (!rule || String(rule.name ?? '') !== 'enum')
    return null

  const values = Array.isArray(rule.allowedValues) ? rule.allowedValues : []
  const literals = values
    .filter(one => typeof one === 'string' || typeof one === 'number')
    .map(one => (typeof one === 'number' ? String(one) : JSON.stringify(one)))

  /*
   * A union of the values it allows, rather than `string`. This is the one place
   * the generated types can be *better* than the database's own: a `state`
   * column typed `'queued' | 'running' | 'succeeded'` catches the comparison
   * against `'suceeded'` that a `string` column never will.
   */
  return literals.length > 0 ? literals.join(' | ') : null
}

/**
 * Map a model attribute to a TS type.
 *
 * Three sources, in order of how much they know: the declared `type`, the
 * validation rule's own name (which is what real models carry), and the shape
 * of a literal `default`. Anything still unaccounted for is `unknown` rather
 * than a guess - a silently-wrong column type is worse than one the call site
 * has to narrow.
 */
function attributeToTsType(attr: Attribute, dialect: Dialect): string {
  const rule = ruleOf(attr)
  const literals = enumUnion(rule)

  if (literals !== null)
    return attr.nullable === true ? `${literals} | null` : literals

  // `type` is the most common discriminator; some attributes carry the
  // type info inside a validation rule instead. Cover both.
  const declared = typeof attr.type === 'string'
    ? attr.type.toLowerCase()
    : String(rule?.name ?? '').toLowerCase()
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
      /*
       * And the rule name `@stacksjs/validation` uses that the column
       * vocabulary does not: a `password` column is a string in the row
       * whatever it means to a form.
       */
      case 'password':
      case 'time':
      case 'year':
        return 'string'
      case 'number':
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
        return booleanType(dialect)
      case 'json':
      case 'jsonb':
        return 'unknown'
      case 'binary':
      case 'blob':
      case 'bytea':
        return 'Uint8Array'
      /*
       * The names validation rules use that the column vocabulary does not.
       * `datetime`/`timestamp` are already above; these are the rest of what
       * `@stacksjs/validation` builds.
       */
      case 'unix':
        return 'number'
      case 'array':
        return 'unknown[]'
      case 'object':
        return 'Record<string, unknown>'
      default:
        return fromDefault(attr, dialect)
    }
  })()
  return attr.nullable === true ? `${base} | null` : base
}

/**
 * The `<target>_id` columns a `belongsTo` implies.
 *
 * Three shapes reach this, and only one of them used to: `['User']`,
 * `{ author: 'User' }`, and - the one every real model in an application
 * writes - `[{ model: 'User', foreignKey: 'author_id' }]`. Handed the third,
 * `snakeCase` was called with an object and threw, which took the whole
 * codegen down: `buddy generate:db-types` crashed rather than emitting types,
 * so the app kept whatever file it generated last.
 *
 * A declared `foreignKey` wins, because that is the column that exists.
 */
function deriveFkColumns(model: Model): Record<string, string> {
  const out: Record<string, string> = {}
  const rel = (model as Model).belongsTo
  if (!rel) return out

  const entries: unknown[] = Array.isArray(rel) ? rel : Object.values(rel as object)

  for (const entry of entries) {
    if (typeof entry === 'string') {
      out[`${snakeCase(entry)}_id`] = 'number'
      continue
    }

    if (entry && typeof entry === 'object') {
      const relation = entry as { model?: unknown, foreignKey?: unknown }

      if (typeof relation.foreignKey === 'string') {
        out[relation.foreignKey] = 'number'
        continue
      }

      if (typeof relation.model === 'string')
        out[`${snakeCase(relation.model)}_id`] = 'number'
    }
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

function pivotColumnToTsType(attribute: { default?: unknown, nullable?: boolean }, dialect: Dialect): string {
  const value = attribute.default
  const base = typeof value === 'string'
    ? 'string'
    : typeof value === 'number'
      ? 'number'
      : typeof value === 'boolean'
        ? booleanType(dialect)
        : value instanceof Date
          ? 'string'
          : 'unknown'

  return attribute.nullable ? `${base} | null` : base
}

/**
 * Read a model's `belongsToMany` declaration and return one pivot-
 * table entry per relation. Handles both shorthand (array of model
 * names) and the explicit `BaseBelongsToMany` form (with
 * `pivotTable` / `firstForeignKey` / `secondForeignKey` overrides).
 */
function derivePivotTables(modelName: string, model: Model, dialect: Dialect): Array<{ table: string, columns: Record<string, string> }> {
  const rel = (model as Model).belongsToMany
  if (!rel) return []
  const out: Array<{ table: string, columns: Record<string, string> }> = []

  const entries = Array.isArray(rel) ? rel : Object.values(rel)
  for (const entry of entries) {
    let related: string
    let table: string | undefined
    let firstFk: string | undefined
    let secondFk: string | undefined
    let pivotColumns: Record<string, { default?: unknown, nullable?: boolean }> = {}
    let timestamps = true

    if (typeof entry === 'string') {
      related = entry
    }
    else if (entry && typeof entry === 'object' && 'model' in entry) {
      const obj = entry as { model: string, pivotTable?: string, firstForeignKey?: string, secondForeignKey?: string }
      related = obj.model
      if ('pivotTable' in obj || 'firstForeignKey' in obj || 'secondForeignKey' in obj) {
        table = obj.pivotTable
        firstFk = obj.firstForeignKey
        secondFk = obj.secondForeignKey
      }
      else {
        const modern = entry as {
          table?: string
          foreignKey?: string
          relatedKey?: string
          pivot?: {
            columns?: Record<string, { default?: unknown, nullable?: boolean }>
            timestamps?: boolean
          }
        }
        table = modern.table
        firstFk = modern.foreignKey
        secondFk = modern.relatedKey
        pivotColumns = modern.pivot?.columns ?? {}
        timestamps = Boolean(modern.pivot?.timestamps)
      }
    }
    else {
      continue
    }

    const tableName = table ?? pivotTableName(modelName, related)
    const fkA = firstFk ?? `${snakeCase(modelName)}_id`
    const fkB = secondFk ?? `${snakeCase(related)}_id`

    const columns: Record<string, string> = {
      id: 'number',
      [fkA]: 'number',
      [fkB]: 'number',
    }

    for (const [column, attribute] of Object.entries(pivotColumns))
      columns[column] = pivotColumnToTsType(attribute, dialect)

    if (timestamps) {
      columns.created_at = 'string'
      columns.updated_at = 'string | null'
    }

    out.push({
      table: tableName,
      columns,
    })
  }

  return out
}

/**
 * The columns the framework guarantees on `users` outside any model.
 *
 * `ensureUsersAuthColumns` adds these with defensive ALTERs, so they are on the
 * table and in no `attributes` block - which meant a query naming one, as the
 * sign-in path does with `two_factor_secret`, fell out of the narrowing overload
 * and answered an unknown-valued row. The list is the same one
 * `USERS_GUARANTEED_COLUMNS` guards in the migration differ; kept here rather
 * than imported so this codegen stays free of the database package's graph.
 */
function usersGuaranteed(dialect: Dialect): Record<string, string> {
  return {
    email_verified_at: 'string | null',
    password_changed_at: 'string | null',
    two_factor_secret: 'string | null',
    two_factor_enabled: `${booleanType(dialect)} | null`,
    two_factor_last_used_step: 'number | null',
    stripe_id: 'string | null',
  }
}

function deriveSystemColumns(model: Model, dialect: Dialect): Record<string, string> {
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

  if ((model.table ?? '') === 'users' || model.name === 'User')
    Object.assign(out, usersGuaranteed(dialect))

  return out
}

function deriveAttributeColumns(model: Model, dialect: Dialect): Record<string, string> {
  const out: Record<string, string> = {}
  const attributes = model.attributes ?? {}
  for (const [name, attr] of Object.entries(attributes)) {
    out[snakeCase(name)] = attributeToTsType(attr as Attribute, dialect)
  }
  return out
}

/*
 * No camelCase aliases here, deliberately.
 *
 * `DatabaseSchema` types the RAW query builder, and a raw row carries exactly
 * the column names the database has: `db.selectFrom('pages').selectAll()`
 * answers `meta_description` and no `metaDescription`. The ORM is the layer
 * that exposes both spellings, through the accessor proxy on a model row -
 * and even there only property access and `in` see the camel spelling, never
 * `Object.keys`, so it is not the raw shape either (see
 * `camel-case-accessors.test.ts`, "leaves serialization on column names").
 *
 * Listing the aliases here typed a property that is `undefined` at runtime as
 * present and required, so `row.metaDescription` compiled and read nothing.
 * `ModelRow<typeof Page>` remains the type to reach for when the value came
 * from the ORM rather than from `db`.
 */

function renderTableEntry(table: string, columns: Record<string, string>, indent = 2): string {
  const outer = '  '.repeat(indent)
  const inner = '  '.repeat(indent + 1)
  const cols = Object.entries(columns)
    .map(([col, ty]) => `${inner}${col}: ${ty}`)
    .join('\n')

  /*
   * Quoted only when it has to be. A pivot table's name comes from two model
   * names and can be anything, and an unquoted key that is not a valid
   * identifier does not compile - but quoting every key would churn the
   * generated file for no reason.
   */
  const key = /^[A-Z_a-z]\w*$/.test(table) ? table : `'${table}'`

  return `${outer}${key}: {\n${inner}// columns\n${cols}\n${outer}}`
}

/**
 * The two shapes this generator can write.
 *
 * `app` augments `DatabaseSchema` from userland, which is what
 * `buddy generate:db-types` produces. `framework` declares `FrameworkSchema`
 * *inside* the database package, so the framework's own default models are typed
 * for the framework's own code - which is the difference between
 * `db.selectFrom('reviews')` answering a review and answering an unknown-valued
 * record that every call site then has to assert.
 *
 * They are separate interfaces rather than one merged declaration on purpose:
 * an app that overrides a default model must win, and declaration merging has no
 * notion of precedence - two declarations of the same table would be a
 * conflict rather than an override.
 */
export type SchemaTarget = 'app' | 'framework'

const APP_HEADER = `/* eslint-disable */
// AUTO-GENERATED by \`buddy generate:db-types\` — do not edit.
// Regenerate after adding/removing a model or changing its attributes.
// See stacksjs/stacks#1923.

declare module '@stacksjs/database' {
  interface DatabaseSchema {
`

const APP_FOOTER = `  }
}

export {}
`

const FRAMEWORK_HEADER = `/* eslint-disable */
// AUTO-GENERATED by \`buddy generate:db-types --framework\` — do not edit.
//
// The shapes of the tables the framework itself ships, so framework code gets
// real rows from \`db.selectFrom(...)\` without asserting them. An application's
// own tables (and its overrides of these) live in \`DatabaseSchema\`, which takes
// precedence - see \`RowOf\` in \`./utils\`.

export interface FrameworkSchema {
`

const FRAMEWORK_FOOTER = `}
`

function headerFor(target: SchemaTarget): string {
  return target === 'framework' ? FRAMEWORK_HEADER : APP_HEADER
}

function footerFor(target: SchemaTarget): string {
  return target === 'framework' ? FRAMEWORK_FOOTER : APP_FOOTER
}

async function loadModelsFrom(
  dir: string,
  recursive: boolean,
  /**
   * Where a file that could not be read is recorded.
   *
   * It used to be swallowed here, under a comment claiming the caller captured
   * it - the caller did not. A model whose import throws simply vanished from
   * the generated types, so the table came out untyped and nothing said why.
   */
  failures: Array<{ file: string, error: string }> = [],
): Promise<Array<{ filePath: string, model: Model }>> {
  const out: Array<{ filePath: string, model: Model }> = []
  if (!fs.existsSync(dir)) return out
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (recursive) {
        const sub = await loadModelsFrom(fullPath, true, failures)
        out.push(...sub)
      }
      continue
    }
    if (!entry.name.endsWith('.ts')) continue
    if (entry.name.startsWith('_') || entry.name.startsWith('index')) continue
    try {
      /*
       * Imported by absolute path.
       *
       * `import('models/Widget.ts')` is a *module specifier*, not a file, so a
       * relative `modelsDir` resolved against this file's own directory and
       * failed - silently, until the line above started reporting it.
       */
      const module = await import(path.isAbsolute(fullPath) ? fullPath : path.resolve(fullPath))
      const def = (module.default || module) as Model
      if (def?.name && (def.attributes || def.table)) {
        out.push({ filePath: fullPath, model: def })
      }
    }
    catch (err) {
      // Non-fatal, and now reported: one unreadable model must not take the
      // other two hundred down with it, and must not disappear either.
      failures.push({ file: fullPath, error: (err as Error).message })
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
  const dialect = resolveDialect(options.dialect)
  const modelsDir = options.modelsDir ?? path.userModelsPath()
  const defaultsDir = options.defaultsDir ?? path.frameworkPath('defaults/app/Models')
  const outFile = options.outFile ?? path.projectPath('database/types.d.ts')

  const errors: GenerateSchemaResult['errors'] = []
  const allModels: Array<{ filePath: string, model: Model }> = []

  for (const [dir, recursive] of [[modelsDir, false], [defaultsDir, true]] as const) {
    try {
      const found = await loadModelsFrom(dir, recursive, errors)
      allModels.push(...found)
    }
    catch (err) {
      errors.push({ file: dir, error: (err as Error).message })
    }
  }

  // User models override defaults for the same model name.
  const byName = new Map<string, { filePath: string, model: Model }>()
  for (const item of allModels) {
    byName.set(item.model.name ?? path.basename(item.filePath).replace(/\.ts$/, ''), item)
  }
  // Re-walk userland last so it wins on collisions.
  for (const item of allModels) {
    if (item.filePath.startsWith(modelsDir)) {
      byName.set(item.model.name ?? path.basename(item.filePath).replace(/\.ts$/, ''), item)
    }
  }

  const tables: GenerateSchemaResult['tables'] = []
  for (const [name, { model }] of byName) {
    const tableName = model.table ?? `${snakeCase(name)}s`
    const columns: Record<string, string> = {
      ...deriveSystemColumns(model, dialect),
      ...deriveAttributeColumns(model, dialect),
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
    for (const pivot of derivePivotTables(name, model, dialect)) {
      if (pivotByTable.has(pivot.table)) continue
      pivotByTable.set(pivot.table, { table: pivot.table, model: `(${pivot.table} pivot)`, columns: pivot.columns })
    }
  }
  tables.push(...pivotByTable.values())

  // Stable alphabetical ordering so diffs are reviewable.
  tables.sort((a, b) => a.table.localeCompare(b.table))

  const target = options.target ?? 'app'
  const indent = target === 'framework' ? 1 : 2
  const body = tables.map(t => renderTableEntry(t.table, t.columns, indent)).join('\n')
  const content = `${headerFor(target)}${body}\n${footerFor(target)}`

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
  target: SchemaTarget = 'app',
): string {
  const body = [...tables]
    .sort((a, b) => a.table.localeCompare(b.table))
    .map(t => renderTableEntry(t.table, t.columns, target === 'framework' ? 1 : 2))
    .join('\n')
  return `${headerFor(target)}${body}\n${footerFor(target)}`
}
