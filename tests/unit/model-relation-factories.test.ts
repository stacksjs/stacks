import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A `belongsTo` foreign key is filled by the seeder from the parent rows it
 * actually created, never by a factory (stacksjs/stacks#3000).
 *
 * The seeder fills a relation column only when the record left it empty, so a
 * factory on one wins. `Campaign.emailListId` drew a random 1 to 8, which only
 * matched real rows while ids happened to start at 1: after `buddy seed
 * --fresh`, which keeps the identity sequences, every campaign insert failed
 * its foreign key and the Campaigns page was empty. A factory returning null
 * changes nothing, since the seeder fills a null too, so none is allowed.
 */
const MODELS = join(import.meta.dir, '../../storage/framework/defaults/app/Models')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : [])
}

function relationNames(belongsTo: unknown): string[] {
  if (Array.isArray(belongsTo))
    return belongsTo.map(relation => typeof relation === 'string' ? relation : (relation as { model: string }).model)
  if (belongsTo && typeof belongsTo === 'object')
    return Object.values(belongsTo).map(relation => typeof relation === 'string' ? relation : (relation as { model: string }).model)
  return []
}

describe('built-in model factories', () => {
  it('leave every belongsTo foreign key to the seeder', async () => {
    const offenders: string[] = []
    for (const file of walk(MODELS)) {
      const model = (await import(file)).default as { name?: string, belongsTo?: unknown, attributes?: Record<string, { factory?: unknown }> }
      if (!model?.attributes)
        continue
      for (const relation of relationNames(model.belongsTo)) {
        const key = `${relation[0]!.toLowerCase()}${relation.slice(1)}Id`
        const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
        if (model.attributes[key]?.factory || model.attributes[snake]?.factory)
          offenders.push(`${model.name}.${key}`)
      }
    }
    expect(offenders.sort()).toEqual([])
  })
})
