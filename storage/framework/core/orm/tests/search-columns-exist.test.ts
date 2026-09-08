import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every column a model's `useSearch` names is a column it has.
 *
 * A name that is not a column indexes nothing, quietly. `Post` already carried
 * a comment about this - "`content`, not `body` - the column is `content`, and
 * the old spelling silently indexed nothing" - and the same pass missed
 * `author`, which is `author_id`. Nine such names were live across four models:
 * `Payment.date` (there is no date column; payments are dated by `created_at`),
 * `WaitlistProduct.partySize` (the field is `quantity`), `CartItem.productId`
 * (cart items carry no product FK - they denormalise `product_name` and
 * `product_sku`), and `Post.author`.
 *
 * Checked against the model's own declaration rather than a live database, so
 * it runs anywhere: attributes it declares, the columns its traits add, and the
 * foreign keys its `belongsTo` implies.
 */

const root = join(import.meta.dir, '..', '..', '..', '..', '..')
const SEARCH_KEYS = ['searchable', 'filterable', 'sortable', 'displayable'] as const

/** Columns every model has, or has once a trait it declares is applied. */
const ALWAYS = ['id', 'uuid', 'created_at', 'updated_at', 'deleted_at']

const snake = (name: string): string => name.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`)

function modelFiles(dir: string, found: string[] = []): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return found
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      modelFiles(path, found)
    else if (entry.name.endsWith('.ts'))
      found.push(path)
  }
  return found
}

/** The column names a model definition implies, in their database spelling. */
function declaredColumns(source: string): Set<string> {
  const columns = new Set(ALWAYS)

  const attributesAt = source.indexOf('attributes: {')
  if (attributesAt !== -1) {
    for (const match of source.slice(attributesAt).matchAll(/^ {4}(\w+):\s*\{/gm))
      columns.add(snake(match[1]))
  }

  // `belongsTo: ['Author']` gives the row an `author_id` nobody declares.
  const belongsTo = /belongsTo\s*:\s*\[([^\]]*)\]/.exec(source)
  if (belongsTo) {
    for (const target of belongsTo[1].matchAll(/'([A-Za-z]\w*)'/g))
      columns.add(`${snake(target[1]).replace(/^_/, '')}_id`)
  }

  return columns
}

describe('useSearch columns', () => {
  const files = modelFiles(join(root, 'storage/framework/defaults/app/Models'))

  it('has models to check', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('name a column the model has', () => {
    const unknown: string[] = []

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const name = source.match(/name:\s*'([A-Za-z]\w*)'/)?.[1]
      if (!name)
        continue

      const columns = declaredColumns(source)
      // A model that declares no attributes at all says nothing to check.
      if (columns.size === ALWAYS.length)
        continue

      for (const key of SEARCH_KEYS) {
        const block = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`).exec(source)
        if (!block)
          continue

        for (const column of block[1].matchAll(/'(\w+)'/g)) {
          if (!columns.has(snake(column[1])))
            unknown.push(`${name}.useSearch.${key} names '${column[1]}', which is not a column`)
        }
      }
    }

    expect([...new Set(unknown)].sort()).toEqual([])
  })
})
