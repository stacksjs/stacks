// Products gain the slug the storefront looks them up by (stacksjs/stacks#3005).
//
// Add to cart, checkout and reviews query `products.slug`, the cart keeps it in
// `cart_items.product_sku`, and product pages link `/products/{slug}`, but the
// table never had the column: every storefront lookup failed with "no such
// column: slug". The corpus now adds it with a unique index, and a backfill
// gives the products that already exist one.

import { Database } from 'bun:sqlite'
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { applySqliteCorpus } from './fixtures/sqlite-corpus'

const CORPUS = join(import.meta.dir, '../../../../../database/migrations')
/** The first migration of the slug change. Everything before it is the old schema. */
const SLUG_CHANGE = '1789486698567'

describe('products.slug', () => {
  it('is unique and filled in for products that existed before it', () => {
    const db = new Database(':memory:')
    applySqliteCorpus(db, CORPUS, file => file < SLUG_CHANGE)

    const insert = db.query('INSERT INTO "products" ("name", "price", "preparation_time") VALUES (?, 1000, 5)')
    for (const name of ['Trail Runner', 'Trail Runner', 'Café & Bar', 'Ergonomic Steel Chair', '!!!'])
      insert.run(name)

    applySqliteCorpus(db, CORPUS, file => file >= SLUG_CHANGE)

    const slugs = db.query('SELECT "name", "slug" FROM "products" ORDER BY "id"').all()
    expect(slugs).toEqual([
      // Two products cannot share an address, so a shared name keeps its id.
      { name: 'Trail Runner', slug: 'trail-runner-1' },
      { name: 'Trail Runner', slug: 'trail-runner-2' },
      { name: 'Café & Bar', slug: 'café-bar' },
      { name: 'Ergonomic Steel Chair', slug: 'ergonomic-steel-chair' },
      { name: '!!!', slug: 'product-5' },
    ])
    expect(() => insert.run('Duplicate')).not.toThrow()
    expect(() => db.run('UPDATE "products" SET "slug" = \'café-bar\' WHERE "name" = \'Duplicate\'')).toThrow(/UNIQUE/)
  })
})
