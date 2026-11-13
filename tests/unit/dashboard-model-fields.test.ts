import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { schema } from '@stacksjs/validation'
import {
  humanizeIdentifier,
  modelCreateFields,
  modelFieldType,
  prepareModelFields,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'
import { loadModelRegistry } from '../../storage/framework/core/orm/src/model-registry'

/**
 * How a model's fields are asked for in the dashboard's create and edit forms
 * (stacksjs/stacks#3256).
 *
 * The edit form drew every field as a line of text, whatever it held. The
 * create form knew a few kinds and had three of them wrong in ways that
 * failed on save: a moment was a number box though its column is a
 * timestamp, and a decimal and a unix time were text, which their own rules
 * refuse.
 */
function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

const field = (rule: unknown, extra: Record<string, unknown> = {}) => ({ fillable: true, validation: { rule }, ...extra })

describe('the kind of input a field gets', () => {
  test('follows its validation rule', () => {
    expect(modelFieldType('status', field(schema.enum(['draft', 'live'])))).toBe('enum')
    expect(modelFieldType('archived', field(schema.boolean()))).toBe('boolean')
    expect(modelFieldType('opensAt', field(schema.date()))).toBe('date')
    expect(modelFieldType('title', field(schema.string()))).toBe('text')
    expect(modelFieldType('billingEmail', field(schema.string()))).toBe('email')
  })

  test('a moment is a date and time, not a number', () => {
    // Its column is a timestamp. A number box invited a unix time the
    // database then refused.
    expect(modelFieldType('publishedAt', field(schema.timestamp()))).toBe('datetime')
    expect(modelFieldType('recordedAt', field(schema.timestampTz()))).toBe('datetime')
  })

  test('every number rule is a number box, decimals and unix times included', () => {
    // These two were text boxes, and text is refused by both rules.
    expect(schema.float().validate('1.5').valid).toBe(false)
    expect(schema.unix().validate('2026-11-11T00:00:00Z').valid).toBe(false)
    for (const rule of [schema.number(), schema.integer(), schema.float(), schema.unix()])
      expect(modelFieldType('value', field(rule))).toBe('number')
  })

  test('prose and JSON get a tall box', () => {
    expect(modelFieldType('body', field(schema.string(), { type: 'text' }))).toBe('longtext')
    expect(modelFieldType('graph', field((schema as any).json()))).toBe('json')
    // A choice or a number declared `text` for its column is still what its rule says.
    expect(modelFieldType('status', field(schema.enum(['a', 'b']), { type: 'text' }))).toBe('enum')
  })

  test('holds for every shipped model: no moment, decimal or JSON field is a plain text or number box', async () => {
    const models = await loadModelRegistry({
      defaultsRoot: resolve('storage/framework/defaults/app/Models'),
      userRoot: join(tmpdir(), 'stacks-no-user-models'),
    }) as Record<string, any>
    const expected: Record<string, string> = { timestamp: 'datetime', timestampTz: 'datetime', date: 'date', json: 'json', float: 'number', unix: 'number', number: 'number', integer: 'number', boolean: 'boolean' }
    const wrong: string[] = []
    let checked = 0
    for (const [name, model] of Object.entries(models)) {
      const fields = Object.fromEntries(modelCreateFields(model).map(entry => [entry.name, entry.type]))
      for (const [attribute, definition] of Object.entries((model.attributes ?? {}) as Record<string, any>)) {
        const rule = definition?.validation?.rule
        const want = Array.isArray(rule?.allowedValues) && rule.allowedValues.length > 0 ? 'enum' : expected[rule?.name]
        // A key the model also declares a belongsTo for is asked for as the
        // record it points at, whatever its own rule says (stacksjs/stacks#3257).
        if (!want || !(attribute in fields) || fields[attribute] === 'relation')
          continue
        checked += 1
        if (fields[attribute] !== want)
          wrong.push(`${name}.${attribute}: ${rule.name} is asked for as ${fields[attribute]}`)
      }
    }
    expect(wrong).toEqual([])
    // The survey this fix came from counted 57 moments and 81 choices alone.
    expect(checked).toBeGreaterThan(300)
  })
})

describe('what a form sends becomes what the column stores', () => {
  const Post = {
    attributes: {
      title: field(schema.string().required()),
      scheduledAt: field(schema.timestamp()),
      recordedAt: field(schema.timestampTz()),
      weight: field(schema.float()),
      likes: field(schema.number()),
      settings: field((schema as any).json()),
      featured: field(schema.boolean()),
    },
  }

  test('a moment arrives with its offset and is stored as the framework stores every other', () => {
    // 09:30 in a zone eight hours ahead of UTC.
    const { data, errors } = prepareModelFields(Post, { scheduledAt: '2026-12-24T01:30:00.000Z', recordedAt: '2026-12-24T01:30:00.000Z' }, true)
    expect(errors).toEqual({})
    // No `T`, no `Z`: neither is a datetime to MySQL.
    expect(data.scheduledAt).toBe('2026-12-24 01:30:00')
    // The one rule that keeps a zone gets the full ISO string it asks for.
    expect(data.recordedAt).toBe('2026-12-24T01:30:00.000Z')
  })

  test('an offset is honoured, not dropped', () => {
    const { data } = prepareModelFields(Post, { scheduledAt: '2026-12-24T09:30:00+08:00' }, true)
    expect(data.scheduledAt).toBe('2026-12-24 01:30:00')
  })

  test('something that is not a moment is refused, on its field', () => {
    const { data, errors } = prepareModelFields(Post, { scheduledAt: 'next tuesday' }, true)
    expect(Object.keys(errors)).toEqual(['scheduledAt'])
    expect(data).toEqual({})
  })

  test('numbers typed into a form are numbers when they reach their rule', () => {
    const { data, errors } = prepareModelFields(Post, { weight: '1.5', likes: '42' }, true)
    expect(errors).toEqual({})
    expect(data).toEqual({ weight: 1.5, likes: 42 })
    expect(Object.keys(prepareModelFields(Post, { likes: 'many' }, true).errors)).toEqual(['likes'])
  })

  test('JSON is stored as text, whether it was typed or sent as a value', () => {
    expect(prepareModelFields(Post, { settings: '{"theme":"dark"}' }, true).data).toEqual({ settings: '{"theme":"dark"}' })
    expect(prepareModelFields(Post, { settings: { theme: 'dark' } }, true).data).toEqual({ settings: '{"theme":"dark"}' })
    expect(Object.keys(prepareModelFields(Post, { settings: '{theme: dark' }, true).errors)).toEqual(['settings'])
  })

  test('an emptied field is cleared; a checkbox is yes or no', () => {
    expect(prepareModelFields(Post, { scheduledAt: null, settings: '', featured: false }, true).data).toEqual({ scheduledAt: null, settings: null, featured: false })
    expect(prepareModelFields(Post, { featured: 'on' }, true).data).toEqual({ featured: true })
  })
})

describe('labels read as words', () => {
  test('whichever way the name was written', () => {
    expect(humanizeIdentifier('SocialPost')).toBe('Social Post')
    expect(humanizeIdentifier('imageUrl')).toBe('Image URL')
    expect(humanizeIdentifier('image_url')).toBe('Image URL')
    expect(humanizeIdentifier('externalId')).toBe('External ID')
    expect(humanizeIdentifier('user_ids')).toBe('User IDs')
    expect(humanizeIdentifier('ipAddress')).toBe('IP Address')
    expect(humanizeIdentifier('SmsOptOut')).toBe('SMS Opt Out')
    expect(humanizeIdentifier('two_factor_enabled')).toBe('Two Factor Enabled')
  })

  test('a word that only contains an initialism is left alone', () => {
    expect(humanizeIdentifier('idea')).toBe('Idea')
    expect(humanizeIdentifier('valid')).toBe('Valid')
    expect(humanizeIdentifier('skipped')).toBe('Skipped')
  })

  test('the model endpoint has one label maker, and says the model\'s name in words', () => {
    const show = source('storage/framework/defaults/app/Actions/Dashboard/Models/ModelShowAction.ts')
    expect(show).not.toContain('function humanize(')
    expect(show).toContain('modelLabel: humanizeIdentifier(modelName),')
    expect(show).toContain('response.updateFields = response.writeCapabilities.update ? [...formFields(), ...modelSwitchFields(Model)] : []')
  })
})
