import type { MakeOptions } from '@stacksjs/types'
import { italic } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { path as p } from '@stacksjs/path'
import { writeTextFile } from '@stacksjs/storage'
import { isDryRunActive } from './make'

/**
 * Field declaration for CRUD scaffolding. Examples:
 *
 *   --fields=title,body
 *   --fields=title:string,body:text,published:boolean,views:number
 */
export interface CrudField {
  name: string
  type: 'string' | 'text' | 'number' | 'boolean' | 'date' | 'json'
}

const TYPE_ALIASES: Record<string, CrudField['type']> = {
  str: 'string',
  string: 'string',
  varchar: 'string',
  text: 'text',
  longtext: 'text',
  int: 'number',
  integer: 'number',
  number: 'number',
  num: 'number',
  bool: 'boolean',
  boolean: 'boolean',
  date: 'date',
  datetime: 'date',
  json: 'json',
}

export function parseFields(input: string | undefined): CrudField[] {
  if (!input) return []
  const parts = input.split(',').map(p => p.trim()).filter(Boolean)
  const out: CrudField[] = []
  for (const part of parts) {
    const [rawName, rawType = 'string'] = part.split(':')
    const name = rawName?.trim()
    if (!name) continue
    const type = TYPE_ALIASES[rawType.trim().toLowerCase()] ?? 'string'
    out.push({ name, type })
  }
  return out
}

function pluralize(word: string): string {
  if (!word) return word
  const lower = word.toLowerCase()
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z') || lower.endsWith('ch') || lower.endsWith('sh'))
    return `${word}es`
  if (lower.endsWith('y') && !/[aeiou]y$/.test(lower))
    return `${word.slice(0, -1)}ies`
  return `${word}s`
}

function pascalCase(name: string): string {
  return name.replace(/(^|[-_\s])(\w)/g, (_, __, c) => String(c).toUpperCase())
}

function snakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
}

function attributeBlock(fields: CrudField[]): string {
  if (fields.length === 0) {
    return `    title: { type: 'string', fillable: true, validation: { rule: schema.string().required() } },`
  }
  return fields
    .map((f) => {
      const t = f.type
      const rule = t === 'number'
        ? 'schema.number()'
        : t === 'boolean'
          ? 'schema.boolean()'
          : t === 'date'
            ? 'schema.date()'
            : t === 'json'
              ? 'schema.object({})'
              : 'schema.string()'
      const dbType = t === 'number' ? 'number' : t === 'boolean' ? 'boolean' : t === 'date' ? 'date' : t === 'json' ? 'json' : 'string'
      return `    ${f.name}: { type: '${dbType}', fillable: true, validation: { rule: ${rule} } },`
    })
    .join('\n')
}

function migrationColumns(fields: CrudField[]): string {
  if (fields.length === 0) return `    .addColumn('title', 'varchar(255)', col => col.notNull())`
  return fields
    .map((f) => {
      switch (f.type) {
        case 'number': return `    .addColumn('${f.name}', 'integer')`
        case 'boolean': return `    .addColumn('${f.name}', 'boolean', col => col.defaultTo(false))`
        case 'text': return `    .addColumn('${f.name}', 'text')`
        case 'date': return `    .addColumn('${f.name}', 'timestamp')`
        case 'json': return `    .addColumn('${f.name}', 'text')`
        default: return `    .addColumn('${f.name}', 'varchar(255)')`
      }
    })
    .join('\n')
}

function actionStub(name: string, kind: 'Index' | 'Show' | 'Store' | 'Update' | 'Destroy', fields: CrudField[]): string {
  const Model = pascalCase(name)
  switch (kind) {
    case 'Index':
      return `import { Action } from '@stacksjs/actions'
import ${Model} from '~/app/Models/${Model}'

export default new Action({
  name: '${Model}IndexAction',
  description: 'List ${pluralize(Model)}',

  async handle() {
    return await ${Model}.all()
  },
})`

    case 'Show':
      return `import { Action } from '@stacksjs/actions'
import ${Model} from '~/app/Models/${Model}'

export default new Action({
  name: '${Model}ShowAction',
  description: 'Show a single ${Model}',

  async handle(request) {
    const id = Number(request.get('id'))
    return await ${Model}.findOrFail(id)
  },
})`

    case 'Store': {
      const keys = (fields.length > 0 ? fields : [{ name: 'title', type: 'string' }]).map(f => `'${f.name}'`).join(', ')
      return `import { Action } from '@stacksjs/actions'
import ${Model} from '~/app/Models/${Model}'

export default new Action({
  name: '${Model}StoreAction',
  description: 'Create a new ${Model}',

  async handle(request) {
    const data = request.only([${keys}])
    return await ${Model}.create(data)
  },
})`
    }

    case 'Update': {
      const keys = (fields.length > 0 ? fields : [{ name: 'title', type: 'string' }]).map(f => `'${f.name}'`).join(', ')
      return `import { Action } from '@stacksjs/actions'
import ${Model} from '~/app/Models/${Model}'

export default new Action({
  name: '${Model}UpdateAction',
  description: 'Update an existing ${Model}',

  async handle(request) {
    const id = Number(request.get('id'))
    const data = request.only([${keys}])
    return await ${Model}.update(id, data)
  },
})`
    }

    case 'Destroy':
      return `import { Action } from '@stacksjs/actions'
import ${Model} from '~/app/Models/${Model}'

export default new Action({
  name: '${Model}DestroyAction',
  description: 'Delete a ${Model}',

  async handle(request) {
    const id = Number(request.get('id'))
    const deleted = await ${Model}.delete(id)
    return { deleted }
  },
})`
  }
}

function modelStub(name: string, fields: CrudField[]): string {
  const Model = pascalCase(name)
  return `import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: '${Model}',
  table: '${pluralize(snakeCase(name))}',
  attributes: {
${attributeBlock(fields)}
  },
  traits: { useTimestamps: true, useUuid: false },
} as const)
`
}

function migrationStub(name: string, fields: CrudField[]): string {
  const table = pluralize(snakeCase(name))
  return `import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('${table}')
    .addColumn('id', 'serial', col => col.primaryKey())
${migrationColumns(fields)}
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
`
}

async function writeFile(path: string, contents: string): Promise<void> {
  if (isDryRunActive()) {
    const lines = contents.split('\n')
    log.info(`[dry-run] would write ${path} (${lines.length} lines)`)
    process.stdout.write(`${lines.slice(0, 60).map(l => `  ${l}`).join('\n')}\n\n`)
    return
  }
  await writeTextFile({ path, data: contents })
}

/**
 * Generate a complete CRUD stack for a resource:
 *   - app/Models/<Model>.ts        (defineModel definition)
 *   - database/migrations/<ts>-create-<table>-table.ts
 *   - app/Actions/<Model>{Index,Show,Store,Update,Destroy}Action.ts
 *
 * Honors `--dry-run` via the shared `isDryRunActive()` flag, so users
 * can preview every file before committing to disk.
 *
 * @example
 *   buddy scaffold:crud Post --fields=title:string,body:text,published:boolean
 */
export async function scaffoldCrud(name: string, options: MakeOptions & { fields?: string }): Promise<void> {
  const Model = pascalCase(name)
  if (!Model) {
    throw new Error('scaffold:crud requires a non-empty resource name')
  }
  const fields = parseFields(options.fields)
  log.info(`Scaffolding CRUD for ${italic(Model)} (${fields.length || 'no'} fields)`)

  // Model
  await writeFile(p.userModelsPath(`${Model}.ts`), modelStub(Model, fields))

  // Migration with timestamp prefix so it sorts correctly
  const ts = Date.now().toString()
  const migrationName = `${ts}-create-${pluralize(snakeCase(name))}-table.ts`
  await writeFile(p.userMigrationsPath(migrationName), migrationStub(name, fields))

  // Actions (5 standard CRUD endpoints)
  for (const kind of ['Index', 'Show', 'Store', 'Update', 'Destroy'] as const) {
    await writeFile(p.userActionsPath(`${Model}${kind}Action.ts`), actionStub(name, kind, fields))
  }

  log.success(`CRUD scaffold complete: model + migration + 5 actions for ${Model}`)
  log.info(`Next: register \`route.resource('${pluralize(snakeCase(name))}', '${Model}')\` in routes/api.ts`)
}
