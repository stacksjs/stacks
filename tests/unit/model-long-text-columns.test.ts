import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { faker } from '@stacksjs/faker'

/**
 * A built-in attribute holds what its own factory produces, on MySQL too
 * (stacksjs/stacks#3015).
 *
 * An unbounded `schema.string()` is `text` on PostgreSQL and SQLite but
 * `varchar(255)` on MySQL, deliberately (#2965): MySQL cannot index TEXT
 * without a prefix. A long-form attribute says so with `type: 'text'`. Release
 * notes, campaign bodies and error details did not, so `buddy seed` on MySQL
 * failed with "Data too long for column", and real values, a stack trace or an
 * email body, could never have fit either.
 */
const MODELS = join(import.meta.dir, '../../storage/framework/defaults/app/Models')
const SAMPLES = 25

interface Attribute {
  type?: string
  factory?: (...args: unknown[]) => unknown
  validation?: { rule?: { name?: string, getRules?: () => Array<{ name?: string, params?: Record<string, unknown> }> } }
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : [])
}

/** A string rule with no `.max()`: the column MySQL makes `varchar(255)`. */
function unboundedString(attribute: Attribute): boolean {
  const rule = attribute.validation?.rule
  if (rule?.name !== 'string' || attribute.type === 'text')
    return false
  return !rule.getRules?.().some(entry => entry.name === 'max')
}

async function longestFactoryValue(factory: Attribute['factory']): Promise<number> {
  const context = { pick: () => { throw new Error('no rows to pick in this test') } }
  let longest = 0
  for (let i = 0; i < SAMPLES; i++) {
    try {
      const value = await factory!(faker, {}, context)
      if (typeof value === 'string')
        longest = Math.max(longest, value.length)
    }
    catch {
      // A factory that needs real rows is not measurable here.
    }
  }
  return longest
}

describe('built-in long-form attributes', () => {
  it('declare a text column whenever their factory outgrows varchar(255)', async () => {
    const offenders: string[] = []
    for (const file of walk(MODELS)) {
      const model = (await import(file)).default as { name?: string, attributes?: Record<string, Attribute> }
      for (const [name, attribute] of Object.entries(model?.attributes ?? {})) {
        if (typeof attribute.factory !== 'function' || !unboundedString(attribute))
          continue
        const longest = await longestFactoryValue(attribute.factory)
        if (longest > 255)
          offenders.push(`${model.name}.${name} (${longest} characters)`)
      }
    }
    expect(offenders.sort()).toEqual([])
  })
})
