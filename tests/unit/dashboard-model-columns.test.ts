import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { schema } from '@stacksjs/validation'
import { relatedSummaryColumns } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-related'
import { modelListColumns } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'

/**
 * A model chooses the columns its list shows (stacksjs/stacks#3259).
 *
 * A list showed every column its table has. For `User` that is twelve, the
 * two-factor step and the billing id among them, in a table that scrolled
 * sideways past the three that tell accounts apart. The model now names
 * them, in its `dashboard` block, and the same choice shapes its panel on
 * another record's page.
 */
function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

const available = ['id', 'name', 'email', 'team_id', 'email_verified_at', 'stripe_id', 'created_at', 'updated_at']
const model = (columns?: unknown, extra: Record<string, unknown> = {}) => ({ belongsTo: ['Team'], dashboard: { columns }, ...extra })

describe('the columns a list shows', () => {
  test('every column, when the model names none', () => {
    expect(modelListColumns({}, available)).toEqual({ columns: available, unknown: [], declared: false })
    expect(modelListColumns(model([]), available).columns).toEqual(available)
    expect(modelListColumns(model('name'), available).columns).toEqual(available)
  })

  test('the ones it names, in its order', () => {
    expect(modelListColumns(model(['email', 'name', 'created_at']), available)).toEqual({ columns: ['email', 'name', 'created_at'], unknown: [], declared: true })
  })

  test('named as the attribute, the column, or the belongsTo', () => {
    expect(modelListColumns(model(['createdAt', 'email_verified_at', 'team']), available).columns).toEqual(['created_at', 'email_verified_at', 'team_id'])
    expect(modelListColumns(model(['Team', 'teamId', 'team_id']), available).columns).toEqual(['team_id'])
  })

  test('a name the table does not have is reported, not drawn as an empty column', () => {
    expect(modelListColumns(model(['name', 'nickname', 'password']), available)).toEqual({ columns: ['name'], unknown: ['nickname', 'password'], declared: true })
  })

  test('a list of nothing but such names falls back to every column', () => {
    // A typo should not empty the page.
    expect(modelListColumns(model(['nmae']), available)).toEqual({ columns: available, unknown: ['nmae'], declared: false })
  })

  test('a hidden column stays hidden when it is named', () => {
    // The caller hands over only what may be shown.
    const shown = available.filter(column => column !== 'stripe_id')
    expect(modelListColumns(model(['name', 'stripe_id']), shown)).toEqual({ columns: ['name'], unknown: ['stripe_id'], declared: true })
  })

  test('the list endpoint draws the choice and keeps every column sortable and on the record\'s page', () => {
    const show = source('storage/framework/defaults/app/Actions/Dashboard/Models/ModelShowAction.ts')
    expect(show).toContain('const list = modelListColumns(Model, response.displayColumns)')
    expect(show).toContain('response.listColumns = list.columns')
    // Column metadata, which the record's page reads, is still every column.
    expect(show).toContain('response.columnMeta = response.displayColumns.map(name => ({')
    // And a wrong name is said once, where a developer will see it.
    expect(show).toContain('in dashboard.columns, which its table does not have (or hides)')
  })

  test('User names the four that tell accounts apart', () => {
    expect(source('storage/framework/defaults/app/Models/User.ts')).toContain('columns: [\'name\', \'email\', \'emailVerifiedAt\', \'createdAt\'],')
  })
})

describe('a model\'s panel on another record\'s page follows the same choice', () => {
  const Member = {
    belongsTo: ['Team', 'User'],
    dashboard: { columns: ['user', 'role', 'joinedAt', 'team', 'note'] },
    attributes: {
      role: { validation: { rule: schema.enum(['member', 'admin']) } },
      status: { validation: { rule: schema.enum(['active', 'invited']) } },
      joinedAt: { validation: { rule: schema.timestamp() } },
      note: { validation: { rule: schema.string() } },
    },
  }

  test('its columns, in its order, each drawn as what it is', () => {
    expect(relatedSummaryColumns(Member, 'team_id', new Set(['User']))).toEqual([
      { key: 'user_id', label: 'User', type: 'text', relation: 'User' },
      { key: 'role', label: 'Role', type: 'badge' },
      { key: 'joined_at', label: 'Joined', type: 'datetime' },
      // The link back to the page's own record is left out: the same on every row.
      { key: 'note', label: 'Note', type: 'text' },
    ])
  })

  test('a relation to a model that cannot be reached is shown as the id it is', () => {
    expect(relatedSummaryColumns(Member, 'team_id', new Set())[0]).toEqual({ key: 'user_id', label: 'User ID', type: 'text' })
  })

  test('without a choice the panel still picks for itself', () => {
    const { dashboard: _unset, ...plain } = Member
    expect(relatedSummaryColumns(plain, 'team_id', new Set(['User'])).map(column => column.key)).toEqual(['user_id', 'role', 'status', 'created_at'])
  })
})

describe('a link to another record is shown by that record\'s name', () => {
  const show = source('storage/framework/defaults/app/Actions/Dashboard/Models/ModelShowAction.ts')

  test('the list endpoint names them, one lookup per related model for the rows on the page', () => {
    expect(show).toContain('response.relationNames[column] = Object.fromEntries(await recordNames(relation.model, ids))')
    expect(show).toContain('label: response.relations[name]?.label ?? humanizeIdentifier(name),')
  })
})
