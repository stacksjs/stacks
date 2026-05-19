/**
 * Tests for the kanban migrations (stacksjs/stacks#1846 Phase 1).
 *
 * Same strategy as `core/auth/tests/rbac-store-bqb.test.ts`: run the
 * SQL files against an in-memory SQLite via `bun:sqlite` and assert on
 * the resulting schema + constraints. Keeps the migration shape
 * locked-in without needing a real database connection.
 */

import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATION_DIR = join(import.meta.dir, '../../../../../database/migrations')
const MIGRATIONS = [
  '0000000106-create-boards-table.sql',
  '0000000107-create-board_columns-table.sql',
  '0000000108-create-cards-table.sql',
  '0000000109-create-labels-table.sql',
  '0000000110-create-card_labels-table.sql',
  '0000000111-create-card_assignees-table.sql',
]

function applyMigrations(db: Database): void {
  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(MIGRATION_DIR, file), 'utf8')
    db.exec(sql)
  }
}

describe('kanban migrations', () => {
  test('all six files apply cleanly against a fresh SQLite instance', () => {
    const db = new Database(':memory:')
    expect(() => applyMigrations(db)).not.toThrow()
    db.close()
  })

  test('boards table carries the Phase 2 reorder field (position) with a default', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    db.run(`INSERT INTO boards (name) VALUES ('Untitled')`)
    const row = db.query(`SELECT position FROM boards WHERE name = 'Untitled'`).get() as { position: number }
    expect(row.position).toBe(0)
    db.close()
  })

  test('board_columns enforce (board_id, position) lookup index', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const idx = db.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'board_columns'`).all() as Array<{ name: string }>
    expect(idx.map(i => i.name)).toContain('board_columns_board_position_index')
    db.close()
  })

  test('cards table carries both column_id and board_id (denormalised for fast board-wide queries)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const cols = db.query(`PRAGMA table_info(cards)`).all() as Array<{ name: string }>
    const names = cols.map(c => c.name)
    expect(names).toEqual(expect.arrayContaining(['id', 'column_id', 'board_id', 'title', 'description', 'position', 'created_by_user_id', 'due_date', 'archived']))
    db.close()
  })

  test('cards (column_id, position) index exists — the drag-reorder hot path', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const idx = db.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'cards'`).all() as Array<{ name: string }>
    expect(idx.map(i => i.name)).toContain('cards_column_position_index')
    db.close()
  })

  test('labels are unique per board (board_id, name)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)

    db.run(`INSERT INTO boards (name) VALUES ('B1')`)
    db.run(`INSERT INTO labels (board_id, name) VALUES (1, 'Bug')`)
    // Same name on the same board → duplicate
    expect(() => db.run(`INSERT INTO labels (board_id, name) VALUES (1, 'Bug')`)).toThrow()
    // Same name on a different board → allowed
    db.run(`INSERT INTO boards (name) VALUES ('B2')`)
    expect(() => db.run(`INSERT INTO labels (board_id, name) VALUES (2, 'Bug')`)).not.toThrow()

    db.close()
  })

  test('card_labels enforces composite PK (card_id, label_id) — idempotent attach', () => {
    const db = new Database(':memory:')
    applyMigrations(db)

    db.run(`INSERT INTO boards (name) VALUES ('B')`)
    db.run(`INSERT INTO board_columns (board_id, name) VALUES (1, 'Todo')`)
    db.run(`INSERT INTO cards (column_id, board_id, title) VALUES (1, 1, 'A card')`)
    db.run(`INSERT INTO labels (board_id, name) VALUES (1, 'Bug')`)
    db.run(`INSERT INTO card_labels (card_id, label_id) VALUES (1, 1)`)
    expect(() => db.run(`INSERT INTO card_labels (card_id, label_id) VALUES (1, 1)`)).toThrow()

    db.close()
  })

  test('card_assignees pivot tracks assigned_by_user_id for audit trail', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const cols = db.query(`PRAGMA table_info(card_assignees)`).all() as Array<{ name: string }>
    const names = cols.map(c => c.name)
    expect(names).toEqual(expect.arrayContaining(['card_id', 'user_id', 'assigned_by_user_id', 'created_at']))
    db.close()
  })
})
