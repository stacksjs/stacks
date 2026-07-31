import { afterEach, describe, expect, test } from 'bun:test'
import { Database as SqliteDatabase } from 'bun:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const targets = [
  { table: 'products', column: 'image_url', expected: 'product' },
  { table: 'payment_products', column: 'image', expected: 'payment-product' },
  { table: 'social_posts', column: 'image_url', expected: 'social-post' },
  { table: 'cart_items', column: 'product_image', expected: 'cart-item' },
  { table: 'posts', column: 'poster', expected: 'post' },
  { table: 'loyalty_rewards', column: 'image_url', expected: 'loyalty-reward' },
  { table: 'categories', column: 'image_url', expected: 'category' },
] as const

let temporaryDirectory = ''

afterEach(() => {
  if (temporaryDirectory)
    rmSync(temporaryDirectory, { recursive: true, force: true })
  temporaryDirectory = ''
})

describe('seeded image URL migration', () => {
  test('repairs only legacy placeholder URLs with stable row seeds', async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'stacks-image-migration-'))
    const databasePath = join(temporaryDirectory, 'migration.sqlite')
    const sqlite = new SqliteDatabase(databasePath)

    for (const target of targets) {
      sqlite.run(`CREATE TABLE ${target.table} (id INTEGER PRIMARY KEY, ${target.column} TEXT)`)
      sqlite.run(
        `INSERT INTO ${target.table} (id, ${target.column}) VALUES (?, ?), (?, ?)`,
        [7, 'https://via.placeholder.com/640x480', 8, 'https://images.example.com/real.jpg'],
      )
    }
    const migration = readFileSync(
      join(import.meta.dir, '../../database/migrations/1785502251814-repair-seeded-image-urls.sql'),
      'utf8',
    )
    sqlite.exec(migration)
    sqlite.close()

    const result = new SqliteDatabase(databasePath, { readonly: true })
    for (const target of targets) {
      const rows = result.query(`SELECT id, ${target.column} AS image FROM ${target.table} ORDER BY id`).all() as Array<{ id: number, image: string }>
      expect(rows).toEqual([
        { id: 7, image: `https://picsum.photos/seed/${target.expected}-7/640/480` },
        { id: 8, image: 'https://images.example.com/real.jpg' },
      ])
    }
    result.close()
  })
})
