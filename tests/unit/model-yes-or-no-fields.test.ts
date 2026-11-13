import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A built-in field that is yes or no says so (stacksjs/stacks#3300).
 *
 * `EmailList.isPublic`, `EmailList.doubleOptIn`, `Comment.isApproved` and
 * `Post.isFeatured` were declared `schema.number()`. Everything that follows
 * from what a field is then got it wrong: the dashboard's form asked for a
 * number box that took 0 or 1 where every other yes or no is a switch, the
 * list offered a range, and the column was an integer.
 */
const MODELS = join(import.meta.dir, '../../storage/framework/defaults/app/Models')

interface Attribute {
  default?: unknown
  factory?: (...args: unknown[]) => unknown
  validation?: { rule?: { name?: string } }
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : [])
}

/** Named the way a yes or no is: `isPublic`, `hasShipped`, `doubleOptIn`, `twoFactorEnabled`. */
const YES_OR_NO_NAME = /^(?:is|has|can|should|allows?|requires?)[A-Z]|(?:Enabled|OptIn|Verified|Approved|Featured)$/

describe('built-in yes-or-no fields', () => {
  it('none is declared as a number', async () => {
    const offenders: string[] = []
    let numbers = 0
    for (const file of walk(MODELS)) {
      const model = (await import(file)).default as { name?: string, attributes?: Record<string, Attribute> }
      for (const [name, attribute] of Object.entries(model?.attributes ?? {})) {
        if (!['number', 'integer', 'float'].includes(attribute.validation?.rule?.name ?? ''))
          continue
        numbers++
        // By its name, or by a factory that only ever makes a 0 or a 1.
        const coin = /min: 0, max: 1 \}/.test(String(attribute.factory ?? ''))
        if (YES_OR_NO_NAME.test(name) || coin)
          offenders.push(`${model.name}.${name}`)
      }
    }
    // The walk found the models and their numbers: a guard that read nothing would pass.
    expect(numbers).toBeGreaterThan(100)
    expect(offenders).toEqual([])
  })

  it('the four that were are booleans, with a yes or a no for a default', async () => {
    const field = async (file: string, name: string) => ((await import(join(MODELS, file))).default.attributes as Record<string, Attribute>)[name]!
    for (const [file, name, fallback] of [['EmailList.ts', 'isPublic', true], ['EmailList.ts', 'doubleOptIn', true], ['Comment.ts', 'isApproved', false], ['Content/Post.ts', 'isFeatured', undefined]] as const) {
      const attribute = await field(file, name)
      expect(attribute.validation?.rule?.name, name).toBe('boolean')
      expect(attribute.default, name).toBe(fallback)
    }
  })

  it('their writers store a yes or a no, never a 1 or a 0', () => {
    const read = (path: string) => readFileSync(join(import.meta.dir, '../../storage/framework', path), 'utf8')
    // PostgreSQL refuses a number for a boolean column (yes-or-no-columns.test.ts).
    for (const [path, column] of [
      ['core/newsletter/src/lists.ts', 'is_public'],
      ['core/newsletter/src/lists.ts', 'double_opt_in'],
      ['core/cms/src/posts/store.ts', 'is_featured'],
      ['defaults/app/Actions/Dashboard/Content/CommentUpdateAction.ts', 'is_approved'],
      ['defaults/app/Actions/Dashboard/Content/PostStoreAction.ts', 'is_featured'],
      ['defaults/app/Actions/Dashboard/Content/PostUpdateAction.ts', 'is_featured'],
    ] as const) {
      const line = read(path).split('\n').find(candidate => candidate.trim().startsWith(`${column}:`))
      expect(line, `${path} ${column}`).toBeDefined()
      expect(line, `${path} ${column}`).not.toMatch(/\? 1 : 0|\? 0 : 1|Date\.now\(\)/)
    }
    // A featured post was stamped with the time it was made.
    expect(read('core/cms/src/posts/store.ts')).toContain('Boolean(d.is_featured)')
  })
})
