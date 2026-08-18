// What the generated `DatabaseSchema` says a column is.
//
// This codegen is what gives `db.selectFrom('users')` real column types, and it
// had been reading only an attribute's `type` - a field almost no real model
// declares, because a `defineModel()` attribute says
// `validation: { rule: schema.string() }` instead. So nearly every column came
// out `unknown`, and every call site in every application answered that by
// annotating the row `any`. A generated type of `unknown` is worse than none:
// it looks like knowledge and it is the reason the compiler was switched off.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildDatabaseSchema } from '../src/generate-database-schema'

/*
 * Inside the package rather than in a temporary directory.
 *
 * The generator imports each model file, and a model imports `@stacksjs/orm` -
 * which resolves from where the file *is*. A fixture written to `/tmp` cannot
 * resolve it, so the generator would report every fixture as unreadable and the
 * test would be measuring the wrong thing.
 */
const models = join(import.meta.dir, `fixtures-schema-types-${Math.random().toString(16).slice(2)}`)

beforeAll(() => {
  mkdirSync(models, { recursive: true })

  writeFileSync(join(models, 'Widget.ts'), `
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Widget',
  table: 'widgets',
  traits: { useTimestamps: true },
  attributes: {
    label: { fillable: true, validation: { rule: schema.string() } },
    size: { fillable: true, validation: { rule: schema.number() } },
    active: { fillable: true, default: false },
    state: { fillable: true, validation: { rule: schema.enum(['draft', 'live', 'retired']) } },
    notes: { fillable: true },
  },
})
`)

  // A file that cannot be imported at all, for the reporting test below.
  writeFileSync(join(models, 'Broken.ts'), `import { nothing } from './does-not-exist'\nexport default nothing\n`)
})

afterAll(() => {
  rmSync(models, { recursive: true, force: true })
})

describe('a column\'s type', () => {
  test('comes from the validation rule when the attribute declares no `type`', async () => {
    const result = await buildDatabaseSchema({ modelsDir: models, defaultsDir: join(models, 'none'), dryRun: true })
    const widgets = result.tables.find(one => one.table === 'widgets')

    expect(widgets).toBeTruthy()
    expect(widgets!.columns.label).toBe('string')
    expect(widgets!.columns.size).toBe('number')
  })

  test('is the union an enum allows, not `string`', async () => {
    const result = await buildDatabaseSchema({ modelsDir: models, defaultsDir: join(models, 'none'), dryRun: true })
    const widgets = result.tables.find(one => one.table === 'widgets')!

    /*
     * The one place generated types can be better than the database's own: a
     * `state` column typed as its three values catches the comparison against
     * `'retred'` that a `string` column never will.
     */
    expect(widgets.columns.state).toBe('"draft" | "live" | "retired"')
  })

  test('falls back to a literal default, and to `unknown` when there is nothing to go on', async () => {
    const result = await buildDatabaseSchema({ modelsDir: models, defaultsDir: join(models, 'none'), dryRun: true })
    const widgets = result.tables.find(one => one.table === 'widgets')!

    // `default: false` and no rule is a boolean whatever else is missing.
    expect(widgets.columns.active).toBe('boolean')
    // And an attribute with neither says so, rather than guessing.
    expect(widgets.columns.notes).toBe('unknown')
  })
})

describe('a model that cannot be read', () => {
  test('is reported rather than dropped', async () => {
    const result = await buildDatabaseSchema({ modelsDir: models, defaultsDir: join(models, 'none'), dryRun: true })

    /*
     * It used to be swallowed, under a comment claiming the caller recorded it.
     * The consequence was invisible: the table was missing from the generated
     * types, so every query against it went untyped and nothing said why.
     */
    expect(result.errors.some(one => one.file.endsWith('Broken.ts'))).toBe(true)

    // And the readable model beside it still made it through.
    expect(result.tables.some(one => one.table === 'widgets')).toBe(true)
  })
})

describe('a `belongsTo` written the way real models write it', () => {
  test('produces the foreign key column rather than crashing the codegen', async () => {
    const dir = join(import.meta.dir, `fixtures-belongs-to-${Math.random().toString(16).slice(2)}`)

    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'Ticket.ts'), `
import { defineModel } from '@stacksjs/orm'

export default defineModel({
  name: 'Ticket',
  table: 'tickets',
  belongsTo: [{ model: 'Repository', onDelete: 'cascade' }, { model: 'User', foreignKey: 'author_id' }],
  attributes: {},
})
`)

    try {
      const result = await buildDatabaseSchema({ modelsDir: dir, defaultsDir: join(dir, 'none'), dryRun: true })
      const tickets = result.tables.find(one => one.table === 'tickets')

      expect(tickets).toBeTruthy()

      /*
       * `snakeCase` used to be handed the whole `{ model, foreignKey }` object
       * and threw, which took the codegen down with it - so `generate:db-types`
       * emitted nothing and the app kept whatever it had generated last.
       */
      expect(tickets!.columns.repository_id).toBe('number')

      // A declared `foreignKey` wins, because that is the column that exists.
      expect(tickets!.columns.author_id).toBe('number')
      expect(tickets!.columns.user_id).toBeUndefined()
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
