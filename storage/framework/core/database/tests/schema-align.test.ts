import type { DesiredColumn, DesiredSchema, LiveAlignSchema, LiveColumn, LiveIndex } from '../src/schema-align'
import { describe, expect, it } from 'bun:test'
import { comparableIndexKey, postgresIndexStatement } from '../src/index-shape'
import { columnDefinitionsOf, comparableDefault, desiredSchemaFrom, evaluateAlignChecks, planSchemaAlignment, postgresIdentifier } from '../src/schema-align'

/**
 * `buddy migrate:align`'s planner, without a database. The rules under test are
 * the ones that decide between "repair", "refuse" and "only report", so each
 * repair has a case next to the near miss it must not touch.
 */

const column = (name: string, overrides: Partial<DesiredColumn> = {}): DesiredColumn => ({
  name,
  type: 'string',
  isPrimaryKey: false,
  isNullable: true,
  hasDefault: false,
  ...overrides,
})

const liveColumn = (name: string, dataType: string, overrides: Partial<LiveColumn> = {}): LiveColumn => ({
  name,
  dataType,
  udtName: dataType,
  nullable: true,
  ...overrides,
})

const desiredIndex = (statement: string) => desiredSchemaFrom({ dialect: 'postgres', tables: [] }, [statement]).indexes[0]!

const liveIndex = (definition: string, overrides: Partial<LiveIndex> = {}): LiveIndex => {
  const name = /INDEX\s+(\S+)/.exec(definition)![1]!
  const table = /ON\s+(?:public\.)?(\w+)/.exec(definition)![1]!
  return {
    name,
    table,
    unique: /UNIQUE/.test(definition),
    primary: false,
    key: comparableIndexKey(postgresIndexStatement(definition)),
    definition,
    ...overrides,
  }
}

function schemas(desired: Partial<DesiredSchema>, live: Partial<LiveAlignSchema>): [DesiredSchema, LiveAlignSchema] {
  return [
    { tables: new Map(), indexes: [], enums: new Map(), ...desired },
    { tables: new Map(), indexes: [], foreignKeys: [], enums: new Map(), names: new Set(), populated: new Set(), ...live },
  ]
}

describe('postgresIdentifier', () => {
  it('names long identifiers the way the generator does', () => {
    expect(postgresIdentifier('trainer_client_assignments_organization_id_member_user_id_trainer_user_id_unique'))
      .toBe('trainer_client_assignments_organization_id_member_user__186exwq')
    expect(postgresIdentifier('teams_name_unique')).toBe('teams_name_unique')
  })
})

describe('index alignment', () => {
  const users = new Map([['users', new Map([['email', liveColumn('email', 'character varying', { maxLength: 255 })]])]])

  it('renames a legacy-named twin instead of creating a second index', () => {
    const [desired, live] = schemas(
      { indexes: [desiredIndex('CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email")')] },
      { tables: users, indexes: [liveIndex('CREATE UNIQUE INDEX users_users_email_unique ON public.users USING btree (email)')], names: new Set(['users_users_email_unique']) },
    )
    const plan = planSchemaAlignment(desired, live)

    expect(plan.actions.map(a => a.sql)).toEqual(['ALTER INDEX "users_users_email_unique" RENAME TO "users_email_unique"'])
  })

  it('renames a twin Postgres truncated at 63 characters', () => {
    const truncated = 'trainer_client_assignments_trainer_client_assignments_organizat'
    const [desired, live] = schemas(
      { indexes: [desiredIndex('CREATE UNIQUE INDEX "trainer_client_assignments_organization_id_member_user__186exwq" ON "trainer_client_assignments" ("team_id", "member_user_id")')] },
      {
        tables: new Map([['trainer_client_assignments', new Map([['team_id', liveColumn('team_id', 'bigint')], ['member_user_id', liveColumn('member_user_id', 'integer')]])]]),
        indexes: [liveIndex(`CREATE UNIQUE INDEX ${truncated} ON public.trainer_client_assignments USING btree (team_id, member_user_id)`)],
      },
    )

    expect(planSchemaAlignment(desired, live).actions[0]!.sql).toBe(`ALTER INDEX "${truncated}" RENAME TO "trainer_client_assignments_organization_id_member_user__186exwq"`)
  })

  it('does not rename across uniqueness, column order or predicate', () => {
    for (const definition of [
      'CREATE INDEX users_legacy ON public.users USING btree (email)',
      'CREATE UNIQUE INDEX users_legacy ON public.users USING btree (email) WHERE (email IS NOT NULL)',
    ]) {
      const [desired, live] = schemas(
        { indexes: [desiredIndex('CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email")')] },
        { tables: users, indexes: [liveIndex(definition)] },
      )
      expect(planSchemaAlignment(desired, live).actions.map(a => a.kind)).toEqual(['create-index'])
    }
  })

  it('renames the twin that already carries the model\'s name, not another owner\'s', () => {
    // The framework's auth setup owns idx_users_stripe_id and recreates it if
    // it goes missing; users_users_stripe_id_unique is the old spelling of the
    // model's own index.
    const [desired, live] = schemas(
      { indexes: [desiredIndex('CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_id_unique" ON "users" ("stripe_id")')] },
      {
        tables: users,
        indexes: [
          liveIndex('CREATE UNIQUE INDEX idx_users_stripe_id ON public.users USING btree (stripe_id)'),
          liveIndex('CREATE UNIQUE INDEX users_users_stripe_id_unique ON public.users USING btree (stripe_id)'),
        ],
      },
    )
    const plan = planSchemaAlignment(desired, live)

    expect(plan.actions.map(a => a.sql)).toEqual(['ALTER INDEX "users_users_stripe_id_unique" RENAME TO "users_stripe_id_unique"'])
    expect(plan.reports.map(r => `${r.kind} ${r.name}`)).toEqual(['duplicate-index idx_users_stripe_id'])
  })

  it('reports duplicate twins and a taken name, and never drops anything', () => {
    const [desired, live] = schemas(
      { indexes: [desiredIndex('CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email")')] },
      {
        tables: users,
        indexes: [
          liveIndex('CREATE UNIQUE INDEX users_a ON public.users USING btree (email)'),
          liveIndex('CREATE UNIQUE INDEX users_b ON public.users USING btree (email)'),
        ],
      },
    )
    const plan = planSchemaAlignment(desired, live)

    expect(plan.actions.map(a => a.kind)).toEqual(['rename-index'])
    expect(plan.reports.map(r => `${r.kind} ${r.name}`)).toEqual(['duplicate-index users_b'])

    live.names = new Set(['users_email_unique'])
    expect(planSchemaAlignment(desired, live).reports.map(r => r.kind)).toContain('name-conflict')
  })

  it('reports an index whose definition differs from its name\'s', () => {
    const [desired, live] = schemas(
      { indexes: [desiredIndex('CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email")')] },
      { tables: users, indexes: [liveIndex('CREATE INDEX users_email_unique ON public.users USING btree (email)')] },
    )
    const plan = planSchemaAlignment(desired, live)

    expect(plan.actions).toEqual([])
    expect(plan.reports.map(r => r.kind)).toEqual(['index-definition'])
  })

  it('creates a missing unique index behind a duplicates check', () => {
    const [desired, live] = schemas(
      { indexes: [desiredIndex('CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email") WHERE "deleted_at" IS NULL')] },
      { tables: users },
    )
    const [action] = planSchemaAlignment(desired, live).actions

    expect(action!.sql).toBe('CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email") WHERE "deleted_at" IS NULL')
    expect(action!.check).toEqual({
      kind: 'duplicates',
      sql: 'SELECT COUNT(*) AS n FROM (SELECT 1 FROM "users" WHERE "email" IS NOT NULL AND ("deleted_at" IS NULL) GROUP BY "email" HAVING COUNT(*) > 1) AS duplicates',
      // The columns the probe reads, so the planner can tell when one of them
      // is a column it is adding in the same pass (stacksjs/stacks#2966).
      dependsOn: ['email'],
    })
  })
})

describe('foreign key alignment', () => {
  const tables = new Map([
    ['posts', new Map([['team_id', liveColumn('team_id', 'bigint')]])],
    ['teams', new Map([['id', liveColumn('id', 'bigint')]])],
  ])
  const desiredTables = new Map([['posts', [column('team_id', { type: 'bigint', references: { table: 'teams', column: 'id', onDelete: 'cascade' } })]]])

  it('adds a missing foreign key behind an orphan check', () => {
    const [desired, live] = schemas({ tables: desiredTables }, { tables })
    const [action] = planSchemaAlignment(desired, live).actions

    expect(action!.sql).toBe('ALTER TABLE "posts" ADD CONSTRAINT "posts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE')
    expect(action!.check?.kind).toBe('orphans')
  })

  it('leaves a present one alone and reports a different action', () => {
    const [desired, live] = schemas({ tables: desiredTables }, {
      tables,
      foreignKeys: [{ name: 'posts_team_id_fkey', table: 'posts', column: 'team_id', refTable: 'teams', refColumn: 'id', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' }],
    })
    const plan = planSchemaAlignment(desired, live)

    expect(plan.actions).toEqual([])
    expect(plan.reports.map(r => r.kind)).toEqual(['foreign-key'])
  })
})

describe('column alignment', () => {
  const plan = (declared: DesiredColumn, live: LiveColumn, options: Parameters<typeof planSchemaAlignment>[2] = {}) => {
    const [desired, schema] = schemas(
      { tables: new Map([['t', [declared]]]) },
      { tables: new Map([['t', new Map([[live.name, live]])]]) },
    )
    return planSchemaAlignment(desired, schema, options)
  }

  it('widens varchar losslessly and reports narrowing', () => {
    expect(plan(column('a', { maxLength: 100 }), liveColumn('a', 'character varying', { maxLength: 20 })).actions[0]!.sql)
      .toBe('ALTER TABLE "t" ALTER COLUMN "a" TYPE varchar(100)')
    expect(plan(column('a', { type: 'text' }), liveColumn('a', 'character varying', { maxLength: 20 })).actions[0]!.sql)
      .toBe('ALTER TABLE "t" ALTER COLUMN "a" TYPE text')

    const narrowing = plan(column('a', { maxLength: 10 }), liveColumn('a', 'character varying', { maxLength: 20 }))
    expect(narrowing.actions).toEqual([])
    expect(narrowing.reports.map(r => r.kind)).toEqual(['type'])
  })

  it('widens integer to bigint only on request', () => {
    const declared = column('n', { type: 'bigint' })
    const live = liveColumn('n', 'integer')

    expect(plan(declared, live).reports.map(r => r.kind)).toEqual(['optional-widening'])
    expect(plan(declared, live, { widenIntegers: true }).actions[0]!.sql).toBe('ALTER TABLE "t" ALTER COLUMN "n" TYPE bigint')
  })

  it('reports nullability and defaults, never changes them', () => {
    const result = plan(
      column('s', { isNullable: false, hasDefault: true, defaultValue: 'active' }),
      liveColumn('s', 'character varying', { maxLength: 255, default: '\'draft\'::character varying' }),
    )

    expect(result.actions).toEqual([])
    expect(result.reports.map(r => r.kind).sort()).toEqual(['default', 'nullability'])
  })

  it('reads a default the way both sides spell it', () => {
    expect(comparableDefault('\'active\'::teams_status_type')).toBe('active')
    expect(comparableDefault('timezone(\'utc\'::text, now())')).toBe('clock')
    expect(comparableDefault('(now() AT TIME ZONE \'utc\')')).toBe('clock')
    expect(comparableDefault('nextval(\'t_id_seq\'::regclass)')).toBeUndefined()
  })

  it('adds a missing column, nullable when the table has rows and no default', () => {
    const create = 'CREATE TABLE IF NOT EXISTS "t" ("id" BIGSERIAL PRIMARY KEY, "a" varchar(10) not null, "b" text default (\'x\'))'
    const definitions = columnDefinitionsOf(create)
    const [desired, live] = schemas(
      { tables: new Map([['t', [column('a', { definition: definitions.get('a')!, isNullable: false }), column('b', { type: 'text', definition: definitions.get('b')!, hasDefault: true, defaultValue: 'x' })]]]) },
      { tables: new Map([['t', new Map()]]), populated: new Set(['t']) },
    )
    const result = planSchemaAlignment(desired, live)

    expect(result.actions.map(a => a.sql)).toEqual([
      'ALTER TABLE "t" ADD COLUMN IF NOT EXISTS "a" varchar(10)',
      'ALTER TABLE "t" ADD COLUMN IF NOT EXISTS "b" text default (\'x\')',
    ])
    expect(result.reports.map(r => `${r.kind} ${r.name}`)).toEqual(['nullability a'])
  })

  /**
   * A column can carry its foreign key inline, and `migrate:align` never
   * creates tables - so a column that references one the database does not
   * have cannot be added here either. Planned anyway, it failed the whole
   * apply with `relation "campaign_variants" does not exist`.
   */
  it('does not add a column that references a table the database lacks', () => {
    const [desired, live] = schemas(
      {
        tables: new Map([['campaign_sends', [
          column('campaign_variant_id', { definition: '"campaign_variant_id" bigint REFERENCES "campaign_variants"("id")' }),
        ]]]),
      },
      { tables: new Map([['campaign_sends', new Map([['id', liveColumn('id', 'bigint')]])]]) },
    )
    const plan = planSchemaAlignment(desired, live)

    expect(plan.actions).toEqual([])
    expect(plan.reports.map(r => r.detail)).toContain(
      'campaign_sends.campaign_variant_id references campaign_variants, which does not exist - `buddy migrate` creates that table',
    )
  })

  it('still adds a column whose reference the database does have', () => {
    const [desired, live] = schemas(
      {
        tables: new Map([['boards', [
          column('team_id', { definition: '"team_id" bigint REFERENCES "teams"("id")' }),
        ]]]),
      },
      {
        tables: new Map([
          ['boards', new Map([['id', liveColumn('id', 'bigint')]])],
          ['teams', new Map([['id', liveColumn('id', 'bigint')]])],
        ]),
      },
    )
    const plan = planSchemaAlignment(desired, live)

    expect(plan.actions.map(a => a.sql)).toEqual([
      'ALTER TABLE "boards" ADD COLUMN IF NOT EXISTS "team_id" bigint REFERENCES "teams"("id")',
    ])
  })

  it('reports extra columns and missing tables', () => {
    const [desired, live] = schemas(
      { tables: new Map([['t', [column('a')]], ['gone', [column('a')]]]) },
      { tables: new Map([['t', new Map([['a', liveColumn('a', 'character varying', { maxLength: 255 })], ['legacy', liveColumn('legacy', 'text')]])]]) },
    )

    expect(planSchemaAlignment(desired, live).reports.map(r => `${r.kind} ${r.table}`).sort()).toEqual(['extra-column t', 'missing-table gone'])
  })
})

describe('enum alignment', () => {
  it('adds labels the model declares and reports ones it does not', () => {
    const [desired, live] = schemas(
      { enums: new Map([['teams_status_type', ['active', 'paused']]]) },
      { enums: new Map([['teams_status_type', ['active', 'legacy']]]) },
    )
    const plan = planSchemaAlignment(desired, live)

    expect(plan.actions.map(a => a.sql)).toEqual(['ALTER TYPE "teams_status_type" ADD VALUE IF NOT EXISTS \'paused\''])
    expect(plan.reports.map(r => r.kind)).toEqual(['enum'])
  })

  /**
   * A type the database never got is not the same as one missing a label, and
   * skipping it quietly let the plan hand Postgres a column typed by nothing:
   * `ALTER TABLE "campaigns" ADD COLUMN "experiment_metric"
   * "campaigns_experiment_metric_type"` failed the whole transaction with
   * `type "campaigns_experiment_metric_type" does not exist`.
   */
  it('creates an enum type the database does not have', () => {
    const [desired, live] = schemas(
      { enums: new Map([['campaigns_experiment_metric_type', ['opens', 'clicks']]]) },
      { enums: new Map() },
    )
    const plan = planSchemaAlignment(desired, live)

    expect(plan.actions.map(a => a.sql)).toEqual([
      'CREATE TYPE "campaigns_experiment_metric_type" AS ENUM (\'opens\', \'clicks\')',
    ])
    expect(plan.actions[0]!.kind).toBe('create-enum-type')
  })

  it('creates the type before any column that is declared with it', () => {
    const [desired, live] = schemas(
      {
        enums: new Map([['campaigns_experiment_metric_type', ['opens']]]),
        tables: new Map([['campaigns', [column('experiment_metric', { definition: '"experiment_metric" "campaigns_experiment_metric_type"' })]]]),
      },
      { enums: new Map(), tables: new Map([['campaigns', new Map([['id', liveColumn('id', 'bigint')]])]]) },
    )
    const plan = planSchemaAlignment(desired, live)
    const kinds = plan.actions.map(a => a.kind)

    expect(kinds.indexOf('create-enum-type')).toBeGreaterThan(-1)
    expect(kinds.indexOf('add-column')).toBeGreaterThan(-1)
    expect(kinds.indexOf('create-enum-type')).toBeLessThan(kinds.indexOf('add-column'))
  })

  it('does not create a type the database already has', () => {
    const [desired, live] = schemas(
      { enums: new Map([['teams_status_type', ['active']]]) },
      { enums: new Map([['teams_status_type', ['active']]]) },
    )

    expect(planSchemaAlignment(desired, live).actions).toEqual([])
  })
})

describe('desiredSchemaFrom', () => {
  it('reads tables, indexes and enum types off the generator\'s SQL', () => {
    const desired = desiredSchemaFrom(
      { dialect: 'postgres', tables: [{ table: 'teams', indexes: [], columns: [{ name: 'name', type: 'string', maxLength: 100, isPrimaryKey: false, isUnique: true, isNullable: false, hasDefault: false }] }] },
      [
        `CREATE TYPE "teams_status_type" AS ENUM ('active', 'it''s')`,
        'CREATE TABLE IF NOT EXISTS "teams" (\n  "id" BIGSERIAL PRIMARY KEY,\n  "name" varchar(100) not null\n)',
        'CREATE UNIQUE INDEX IF NOT EXISTS "teams_name_unique" ON "teams" ("name")',
        'CREATE INDEX "teams_lower_name" ON "teams" (lower("name"))',
      ],
    )

    expect(desired.enums.get('teams_status_type')).toEqual(['active', 'it\'s'])
    expect(desired.tables.get('teams')![0]!.definition).toBe('"name" varchar(100) not null')
    expect(desired.indexes.map(index => [index.name, index.unique, index.columns])).toEqual([
      ['teams_name_unique', true, ['name']],
      ['teams_lower_name', false, undefined],
    ])
  })
})

/**
 * A plan that adds a column AND the unique index over it describes two moments:
 * the index's duplicates probe reads a column that only exists after the
 * add-column ahead of it has run. Postgres answers the probe with an error, and
 * `migrate:align` used to let that error out of the planner - so the one
 * command for a drifted database refused to describe the drift it found
 * ("Could not compare the database with the models: column "sku" does not
 * exist"). See stacksjs/stacks#2966.
 */
describe('align checks that cannot be answered yet', () => {
  const addSku = {
    kind: 'add-column' as const,
    table: 'product_variants',
    name: 'sku',
    detail: 'add product_variants.sku',
    sql: 'ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "sku" varchar(255)',
  }
  const uniqueOverSku = {
    kind: 'create-index' as const,
    table: 'product_variants',
    name: 'product_variants_product_sku_unique',
    detail: 'create unique index product_variants_product_sku_unique',
    sql: 'CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_sku_unique ON product_variants ("product_id", "sku")',
    check: {
      kind: 'duplicates' as const,
      sql: 'SELECT COUNT(*) AS n FROM (SELECT 1 FROM "product_variants" WHERE "product_id" IS NOT NULL AND "sku" IS NOT NULL GROUP BY "product_id", "sku" HAVING COUNT(*) > 1) AS duplicates',
      dependsOn: ['product_id', 'sku'],
    },
  }
  const missingColumn = async (sql: string) => {
    if (sql.includes('"sku"'))
      throw new Error('column "sku" does not exist')
    return [{ n: 0 }]
  }

  it('keeps planning when a probe reads a column this plan adds', async () => {
    const plan = { actions: [addSku, uniqueOverSku], reports: [], refused: [] }
    const kept = await evaluateAlignChecks(plan, missingColumn)

    expect(kept.map(action => action.name)).toEqual(['sku', 'product_variants_product_sku_unique'])
    expect(plan.refused).toEqual([])
  })

  it('says the probe went unanswered rather than passing it off as checked', async () => {
    const plan = { actions: [addSku, uniqueOverSku], reports: [], refused: [] }
    await evaluateAlignChecks(plan, missingColumn)

    expect(plan.reports).toHaveLength(1)
    expect(plan.reports[0]!.name).toBe('product_variants_product_sku_unique')
    expect(plan.reports[0]!.detail).toContain('product_variants.sku')
  })

  it('still refuses an index whose probe does find duplicates', async () => {
    const plan = { actions: [uniqueOverSku], reports: [], refused: [] }
    const kept = await evaluateAlignChecks(plan, async () => [{ n: 3 }])

    expect(kept).toEqual([])
    expect(plan.refused[0]!.reason).toContain('3 duplicate value(s)')
  })

  it('does not swallow a probe that failed for some other reason', async () => {
    const plan = { actions: [uniqueOverSku], reports: [], refused: [] }

    await expect(evaluateAlignChecks(plan, async () => { throw new Error('connection terminated') }))
      .rejects.toThrow('connection terminated')
  })
})

describe('opt-in model constraint relaxation', () => {
  it('removes a conflicting parent only after the model reference is enforced', () => {
    const correct = { name: 'issues_author_id_fkey', table: 'issues', column: 'author_id', refTable: 'users', refColumn: 'id', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' }
    const wrong = { ...correct, name: 'issues_author_id_fk', refTable: 'authors' }
    const [desired, live] = schemas(
      { tables: new Map([['issues', [column('author_id', { type: 'bigint', references: { table: 'users', column: 'id' } })]]]) },
      { tables: new Map([
        ['issues', new Map([['author_id', liveColumn('author_id', 'bigint')]])],
        ['users', new Map([['id', liveColumn('id', 'bigint')]])],
      ]), foreignKeys: [wrong, correct] },
    )
    expect(planSchemaAlignment(desired, live).actions).toEqual([])
    expect(planSchemaAlignment(desired, live).reports[0]?.name).toBe(wrong.name)
    const plan = planSchemaAlignment(desired, live, { relaxConstraints: true })
    expect(plan.actions.map(action => action.sql)).toEqual(['ALTER TABLE "issues" DROP CONSTRAINT "issues_author_id_fk"'])
    expect(plan.actions[0]?.kind).toBe('drop-conflicting-foreign-key')
    expect(plan.reports).toEqual([])

    live.foreignKeys = [wrong]
    const missing = planSchemaAlignment(desired, live, { relaxConstraints: true })
    expect(missing.actions.map(action => action.kind)).toEqual(['add-foreign-key'])
    expect(missing.actions[0]?.check?.kind).toBe('orphans')
    expect(missing.reports[0]?.name).toBe(wrong.name)

    desired.tables.set('issues', [column('author_id')])
    expect(planSchemaAlignment(desired, live, { relaxConstraints: true }).actions).toEqual([])
  })

  it('relaxes a legacy NOT NULL only when the model allows NULL and the option is enabled', () => {
    const [desired, live] = schemas(
      { tables: new Map([['releases', [column('type')]]]) },
      { tables: new Map([['releases', new Map([['type', liveColumn('type', 'character varying', { nullable: false })]])]]) },
    )
    expect(planSchemaAlignment(desired, live).actions).toHaveLength(0)
    const plan = planSchemaAlignment(desired, live, { relaxConstraints: true })
    expect(plan.actions.map(action => action.sql)).toEqual(['ALTER TABLE "releases" ALTER COLUMN "type" DROP NOT NULL'])
    expect(plan.reports.filter(report => report.kind === 'nullability')).toHaveLength(0)
  })

  it('never makes nullable data required or relaxes a primary key', () => {
    const [desired, live] = schemas(
      { tables: new Map([['records', [column('required', { isNullable: false }), column('id', { isPrimaryKey: true })]]]) },
      { tables: new Map([['records', new Map([
        ['required', liveColumn('required', 'text')], ['id', liveColumn('id', 'bigint', { nullable: false })],
      ])]]) },
    )
    const plan = planSchemaAlignment(desired, live, { relaxConstraints: true })
    expect(plan.actions.filter(action => action.kind === 'relax-nullability')).toHaveLength(0)
    expect(plan.reports.filter(report => report.kind === 'nullability').map(report => report.name)).toEqual(['required'])
  })

  it('removes a foreign key on a polymorphic pair without changing its data', () => {
    const [desired, live] = schemas(
      { tables: new Map([['comments', [column('subject_id'), column('subject_type')]]]) },
      { tables: new Map([['comments', new Map([
        ['subject_id', liveColumn('subject_id', 'integer')], ['subject_type', liveColumn('subject_type', 'text')],
      ])]]), foreignKeys: [{ name: 'comments_subject_fkey', table: 'comments', column: 'subject_id', refTable: 'issues', refColumn: 'id', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' }] },
    )
    expect(planSchemaAlignment(desired, live).actions).toHaveLength(0)
    const plan = planSchemaAlignment(desired, live, { relaxConstraints: true })
    expect(plan.actions.map(action => action.sql)).toEqual(['ALTER TABLE "comments" DROP CONSTRAINT "comments_subject_fkey"'])
    desired.tables.set('comments', [column('subject_id', { references: { table: 'issues', column: 'id' } }), column('subject_type')])
    expect(planSchemaAlignment(desired, live, { relaxConstraints: true }).actions.filter(action => action.kind === 'drop-polymorphic-foreign-key')).toHaveLength(0)
    desired.tables.set('comments', [column('subject_id')])
    expect(planSchemaAlignment(desired, live, { relaxConstraints: true }).actions.filter(action => action.kind === 'drop-polymorphic-foreign-key')).toHaveLength(0)
  })
})
