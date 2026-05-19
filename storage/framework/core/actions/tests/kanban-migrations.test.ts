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
  // Phase 3
  '0000000112-create-card_comments-table.sql',
]

// stacksjs/stacks#1849 — failing-CI notification state.
const CI_NOTIFICATIONS_MIGRATIONS = [
  '0000000113-create-ci_run_states-table.sql',
]

function applyCiNotificationsMigrations(db: Database): void {
  for (const file of CI_NOTIFICATIONS_MIGRATIONS) {
    const sql = readFileSync(join(MIGRATION_DIR, file), 'utf8')
    db.exec(sql)
  }
}

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

// ─── Write-API SQL patterns (Phase 2) ────────────────────────────────
//
// The write actions (BoardDestroyAction, CardsReorderAction, etc.) issue
// hand-built SQL patterns that we lock-in here. Mirrors how the auth
// migrations + store split — schema tests above, behavioural SQL tests
// below. All run against in-memory SQLite so a single test run covers
// both layers.

function seedSampleBoard(db: Database): { boardId: number, col1: number, col2: number, card1: number, card2: number, card3: number } {
  db.run(`INSERT INTO boards (name) VALUES ('B1')`)
  const boardId = (db.query(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id
  db.run(`INSERT INTO board_columns (board_id, name, position) VALUES (?, 'Todo', 0)`, [boardId])
  const col1 = (db.query(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id
  db.run(`INSERT INTO board_columns (board_id, name, position) VALUES (?, 'Done', 1)`, [boardId])
  const col2 = (db.query(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id
  db.run(`INSERT INTO cards (column_id, board_id, title, position) VALUES (?, ?, 'A', 0)`, [col1, boardId])
  const card1 = (db.query(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id
  db.run(`INSERT INTO cards (column_id, board_id, title, position) VALUES (?, ?, 'B', 1)`, [col1, boardId])
  const card2 = (db.query(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id
  db.run(`INSERT INTO cards (column_id, board_id, title, position) VALUES (?, ?, 'C', 0)`, [col2, boardId])
  const card3 = (db.query(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id
  db.run(`INSERT INTO labels (board_id, name) VALUES (?, 'Bug')`, [boardId])
  const labelId = (db.query(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id
  db.run(`INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)`, [card1, labelId])
  db.run(`INSERT INTO card_assignees (card_id, user_id) VALUES (?, 99)`, [card1])
  return { boardId, col1, col2, card1, card2, card3 }
}

describe('Board cascade delete SQL pattern (BoardDestroyAction)', () => {
  test('removes pivots, cards, columns, labels, board — and leaves no orphans', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const { boardId } = seedSampleBoard(db)

    // Mirror the BoardDestroyAction sequence verbatim.
    db.run(
      `DELETE FROM card_labels WHERE card_id IN (SELECT id FROM cards WHERE board_id = ?)`,
      [boardId],
    )
    db.run(
      `DELETE FROM card_assignees WHERE card_id IN (SELECT id FROM cards WHERE board_id = ?)`,
      [boardId],
    )
    db.run(`DELETE FROM cards WHERE board_id = ?`, [boardId])
    db.run(`DELETE FROM board_columns WHERE board_id = ?`, [boardId])
    db.run(`DELETE FROM labels WHERE board_id = ?`, [boardId])
    db.run(`DELETE FROM boards WHERE id = ?`, [boardId])

    const counts = db.query(
      `SELECT
        (SELECT COUNT(*) FROM card_labels) AS card_labels,
        (SELECT COUNT(*) FROM card_assignees) AS card_assignees,
        (SELECT COUNT(*) FROM cards) AS cards,
        (SELECT COUNT(*) FROM board_columns) AS board_columns,
        (SELECT COUNT(*) FROM labels) AS labels,
        (SELECT COUNT(*) FROM boards) AS boards`,
    ).get() as Record<string, number>

    expect(counts.card_labels).toBe(0)
    expect(counts.card_assignees).toBe(0)
    expect(counts.cards).toBe(0)
    expect(counts.board_columns).toBe(0)
    expect(counts.labels).toBe(0)
    expect(counts.boards).toBe(0)

    db.close()
  })

  test('cascade respects board boundary — sibling board\'s data survives', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const first = seedSampleBoard(db)

    // Second board with its own cards.
    db.run(`INSERT INTO boards (name) VALUES ('B2')`)
    const sibling = (db.query(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id
    db.run(`INSERT INTO board_columns (board_id, name) VALUES (?, 'X')`, [sibling])
    const siblingCol = (db.query(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id
    db.run(`INSERT INTO cards (column_id, board_id, title) VALUES (?, ?, 'sibling-card')`, [siblingCol, sibling])

    // Delete only the first board.
    db.run(`DELETE FROM cards WHERE board_id = ?`, [first.boardId])
    db.run(`DELETE FROM board_columns WHERE board_id = ?`, [first.boardId])
    db.run(`DELETE FROM boards WHERE id = ?`, [first.boardId])

    const sibCards = db.query(`SELECT COUNT(*) AS c FROM cards WHERE board_id = ?`).get(sibling) as { c: number }
    const sibCols = db.query(`SELECT COUNT(*) AS c FROM board_columns WHERE board_id = ?`).get(sibling) as { c: number }
    expect(sibCards.c).toBe(1)
    expect(sibCols.c).toBe(1)

    db.close()
  })
})

describe('Card reorder SQL pattern (CardsReorderAction)', () => {
  test('rewrites positions within a single column to match submitted order', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const { col1, card1, card2 } = seedSampleBoard(db)

    // Reverse the column: card2 first, card1 second.
    const newOrder = [card2, card1]
    for (let i = 0; i < newOrder.length; i++) {
      db.run(`UPDATE cards SET column_id = ?, position = ? WHERE id = ?`, [col1, i, newOrder[i]])
    }

    const rows = db.query(`SELECT id, position FROM cards WHERE column_id = ? ORDER BY position ASC`).all(col1) as Array<{ id: number, position: number }>
    expect(rows.map(r => r.id)).toEqual([card2, card1])
    expect(rows.map(r => r.position)).toEqual([0, 1])

    db.close()
  })

  test('cross-column move updates both column_id and position', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const { col1, col2, card1, card2, card3 } = seedSampleBoard(db)

    // Move card1 from col1 → col2 (append). col1 keeps card2; col2
    // becomes [card3, card1].
    const col1Order = [card2]
    const col2Order = [card3, card1]
    for (let i = 0; i < col1Order.length; i++)
      db.run(`UPDATE cards SET column_id = ?, position = ? WHERE id = ?`, [col1, i, col1Order[i]])
    for (let i = 0; i < col2Order.length; i++)
      db.run(`UPDATE cards SET column_id = ?, position = ? WHERE id = ?`, [col2, i, col2Order[i]])

    const c1 = db.query(`SELECT id FROM cards WHERE column_id = ? ORDER BY position ASC`).all(col1) as Array<{ id: number }>
    const c2 = db.query(`SELECT id FROM cards WHERE column_id = ? ORDER BY position ASC`).all(col2) as Array<{ id: number }>
    expect(c1.map(r => r.id)).toEqual([card2])
    expect(c2.map(r => r.id)).toEqual([card3, card1])

    db.close()
  })
})

describe('Column reorder SQL pattern (ColumnsReorderAction)', () => {
  test('rewrites column positions across a board', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const { boardId, col1, col2 } = seedSampleBoard(db)

    // Swap: col2 first, col1 second.
    db.run(`UPDATE board_columns SET position = 0 WHERE id = ?`, [col2])
    db.run(`UPDATE board_columns SET position = 1 WHERE id = ?`, [col1])

    const rows = db.query(`SELECT id, position FROM board_columns WHERE board_id = ? ORDER BY position ASC`).all(boardId) as Array<{ id: number, position: number }>
    expect(rows.map(r => r.id)).toEqual([col2, col1])

    db.close()
  })
})

describe('Board store SQL pattern (BoardStoreAction)', () => {
  test('append-at-end position assignment via MAX(position) + 1', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    db.run(`INSERT INTO boards (name, position) VALUES ('A', 0)`)
    db.run(`INSERT INTO boards (name, position) VALUES ('B', 1)`)

    // Action's pattern: MAX over non-archived rows.
    const maxRow = db.query(`SELECT COALESCE(MAX(position), -1) AS m FROM boards WHERE archived = 0`).get() as { m: number }
    const next = (maxRow.m + 1) || 0
    expect(next).toBe(2)

    db.run(`INSERT INTO boards (name, position) VALUES ('C', ?)`, [next])
    const newBoard = db.query(`SELECT position FROM boards WHERE name = 'C'`).get() as { position: number }
    expect(newBoard.position).toBe(2)

    db.close()
  })

  test('first board on a fresh DB gets position 0 (not -1)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)

    const maxRow = db.query(`SELECT COALESCE(MAX(position), -1) AS m FROM boards WHERE archived = 0`).get() as { m: number }
    const next = (maxRow.m + 1) || 0
    expect(next).toBe(0)

    db.close()
  })
})

// ─── Phase 3: comments + label sync + assignee sync ─────────────────

describe('card_comments migration', () => {
  test('has the columns CardCommentStoreAction relies on', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const cols = db.query(`PRAGMA table_info(card_comments)`).all() as Array<{ name: string }>
    const names = cols.map(c => c.name)
    expect(names).toEqual(expect.arrayContaining(['id', 'uuid', 'card_id', 'user_id', 'body', 'created_at', 'updated_at']))
    db.close()
  })

  test('card_comments(card_id, created_at) index exists for the thread-fetch hot path', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const idx = db.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'card_comments'`).all() as Array<{ name: string }>
    expect(idx.map(i => i.name)).toContain('card_comments_card_created_index')
    db.close()
  })

  test('user_id is nullable (anonymous + dev-dashboard comments)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    db.run(`INSERT INTO boards (name) VALUES ('B')`)
    db.run(`INSERT INTO board_columns (board_id, name) VALUES (1, 'T')`)
    db.run(`INSERT INTO cards (column_id, board_id, title) VALUES (1, 1, 'C')`)
    expect(() => db.run(`INSERT INTO card_comments (card_id, body) VALUES (1, 'hi')`)).not.toThrow()
    db.close()
  })
})

describe('Card cascade delete includes card_comments (CardDestroyAction)', () => {
  test('deleting a card removes its comments AND its pivot rows', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const { card1 } = seedSampleBoard(db)
    db.run(`INSERT INTO card_comments (card_id, body) VALUES (?, 'a')`, [card1])
    db.run(`INSERT INTO card_comments (card_id, body) VALUES (?, 'b')`, [card1])

    db.run(`DELETE FROM card_labels WHERE card_id = ?`, [card1])
    db.run(`DELETE FROM card_assignees WHERE card_id = ?`, [card1])
    db.run(`DELETE FROM card_comments WHERE card_id = ?`, [card1])
    db.run(`DELETE FROM cards WHERE id = ?`, [card1])

    const cm = db.query(`SELECT COUNT(*) AS c FROM card_comments WHERE card_id = ?`).get(card1) as { c: number }
    const cl = db.query(`SELECT COUNT(*) AS c FROM card_labels WHERE card_id = ?`).get(card1) as { c: number }
    expect(cm.c).toBe(0)
    expect(cl.c).toBe(0)

    db.close()
  })
})

describe('Card labels sync SQL pattern (CardLabelsSyncAction)', () => {
  test('replaces the full set: delete-then-insert', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const { boardId, card1 } = seedSampleBoard(db)
    db.run(`INSERT INTO labels (board_id, name) VALUES (?, 'Feature')`, [boardId])
    db.run(`INSERT INTO labels (board_id, name) VALUES (?, 'Docs')`, [boardId])
    const featureId = (db.query(`SELECT id FROM labels WHERE board_id = ? AND name = 'Feature'`).get(boardId) as { id: number }).id
    const docsId = (db.query(`SELECT id FROM labels WHERE board_id = ? AND name = 'Docs'`).get(boardId) as { id: number }).id

    // Seed: card1 carries 'Bug' (the original).
    // After sync to [feature, docs]: 'Bug' should be gone.
    db.run(`DELETE FROM card_labels WHERE card_id = ?`, [card1])
    db.run(`INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)`, [card1, featureId])
    db.run(`INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)`, [card1, docsId])

    const rows = db.query(`SELECT label_id FROM card_labels WHERE card_id = ? ORDER BY label_id ASC`).all(card1) as Array<{ label_id: number }>
    expect(rows.map(r => r.label_id).sort()).toEqual([featureId, docsId].sort())

    db.close()
  })

  test('label deletion strips it from every card that carried it (LabelDestroyAction)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const { boardId, card1, card2 } = seedSampleBoard(db)
    const labelId = (db.query(`SELECT id FROM labels WHERE board_id = ?`).get(boardId) as { id: number }).id
    // card1 already has the seeded label; attach to card2 too.
    db.run(`INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)`, [card2, labelId])

    // LabelDestroyAction sequence:
    db.run(`DELETE FROM card_labels WHERE label_id = ?`, [labelId])
    db.run(`DELETE FROM labels WHERE id = ?`, [labelId])

    const cl = db.query(`SELECT COUNT(*) AS c FROM card_labels WHERE label_id = ?`).get(labelId) as { c: number }
    const l = db.query(`SELECT COUNT(*) AS c FROM labels WHERE id = ?`).get(labelId) as { c: number }
    expect(cl.c).toBe(0)
    expect(l.c).toBe(0)
    // Sibling cards' other pivots untouched.
    const allCl = db.query(`SELECT COUNT(*) AS c FROM card_labels WHERE card_id = ?`).get(card1) as { c: number }
    expect(allCl.c).toBe(0)

    db.close()
  })
})

describe('Card assignees sync SQL pattern (CardAssigneesSyncAction)', () => {
  test('replaces assignees and persists assigned_by_user_id', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const { card1 } = seedSampleBoard(db)
    // Stub a users table — the real one isn't part of the kanban
    // migration set, but the sync action joins/inserts against it.
    db.run(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)`)
    db.run(`INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'a@x'), (2, 'Bob', 'b@x'), (3, 'Cara', 'c@x')`)

    // Initial: card1 already has user_id=99 from seedSampleBoard.
    // Sync to [1, 2] with assigned_by_user_id=99.
    db.run(`DELETE FROM card_assignees WHERE card_id = ?`, [card1])
    db.run(`INSERT INTO card_assignees (card_id, user_id, assigned_by_user_id) VALUES (?, 1, 99), (?, 2, 99)`, [card1, card1])

    const rows = db.query(`SELECT user_id, assigned_by_user_id FROM card_assignees WHERE card_id = ? ORDER BY user_id ASC`).all(card1) as Array<{ user_id: number, assigned_by_user_id: number | null }>
    expect(rows.map(r => r.user_id)).toEqual([1, 2])
    expect(rows.every(r => r.assigned_by_user_id === 99)).toBe(true)

    db.close()
  })
})

describe('Card thread ordering (CardShowAction)', () => {
  test('comments come back oldest-first via (card_id, created_at) order', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const { card1 } = seedSampleBoard(db)
    // Force insertion order with explicit created_at timestamps so the
    // test isn't a race against same-millisecond default values.
    db.run(`INSERT INTO card_comments (card_id, body, created_at) VALUES (?, 'first',  '2026-05-20 00:00:00')`, [card1])
    db.run(`INSERT INTO card_comments (card_id, body, created_at) VALUES (?, 'second', '2026-05-20 00:01:00')`, [card1])
    db.run(`INSERT INTO card_comments (card_id, body, created_at) VALUES (?, 'third',  '2026-05-20 00:02:00')`, [card1])

    const rows = db.query(`SELECT body FROM card_comments WHERE card_id = ? ORDER BY created_at ASC, id ASC`).all(card1) as Array<{ body: string }>
    expect(rows.map(r => r.body)).toEqual(['first', 'second', 'third'])

    db.close()
  })
})

// ─── #1849 failing-CI notifications — ci_run_states ─────────────────

describe('ci_run_states migration (stacksjs/stacks#1849)', () => {
  test('applies cleanly to a fresh in-memory SQLite', () => {
    const db = new Database(':memory:')
    expect(() => applyCiNotificationsMigrations(db)).not.toThrow()
    db.close()
  })

  test('has the columns the failure-notifier upserts against', () => {
    const db = new Database(':memory:')
    applyCiNotificationsMigrations(db)
    const cols = db.query(`PRAGMA table_info(ci_run_states)`).all() as Array<{ name: string }>
    const names = cols.map(c => c.name)
    expect(names).toEqual(expect.arrayContaining([
      'repo_full_name',
      'last_conclusion',
      'last_run_id',
      'last_seen_at',
      'last_notified_at',
    ]))
    db.close()
  })

  test('repo_full_name is the primary key — duplicate insert rejects', () => {
    const db = new Database(':memory:')
    applyCiNotificationsMigrations(db)
    db.run(`INSERT INTO ci_run_states (repo_full_name) VALUES ('org/a')`)
    expect(() => db.run(`INSERT INTO ci_run_states (repo_full_name) VALUES ('org/a')`)).toThrow()
    db.close()
  })

  test('last_notified_at index exists (cooldown-lookup hot path)', () => {
    const db = new Database(':memory:')
    applyCiNotificationsMigrations(db)
    const idx = db.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ci_run_states'`).all() as Array<{ name: string }>
    expect(idx.map(i => i.name)).toContain('ci_run_states_last_notified_index')
    db.close()
  })
})

describe('CI failure notifier SQL patterns (failure-notifier.ts)', () => {
  test('upsert path: SELECT-then-INSERT/UPDATE replays correctly', () => {
    const db = new Database(':memory:')
    applyCiNotificationsMigrations(db)

    // First run: no existing row → INSERT.
    // bun:sqlite's `.get()` returns `null` when no row matches (not
    // `undefined`); the upsert path checks truthiness, so either
    // shape behaves the same in production.
    const existing1 = db.query(`SELECT repo_full_name FROM ci_run_states WHERE repo_full_name = ?`).get('org/a')
    expect(existing1).toBeNull()
    db.run(
      `INSERT INTO ci_run_states (repo_full_name, last_conclusion, last_run_id, last_seen_at, updated_at) VALUES (?, 'success', 100, ?, ?)`,
      ['org/a', '2026-05-20T12:00:00Z', '2026-05-20T12:00:00Z'],
    )

    // Second run: row exists → UPDATE.
    const existing2 = db.query(`SELECT repo_full_name FROM ci_run_states WHERE repo_full_name = ?`).get('org/a') as { repo_full_name: string } | undefined
    expect(existing2?.repo_full_name).toBe('org/a')
    db.run(
      `UPDATE ci_run_states SET last_conclusion = 'failure', last_run_id = 101, last_seen_at = ?, updated_at = ? WHERE repo_full_name = ?`,
      ['2026-05-20T12:05:00Z', '2026-05-20T12:05:00Z', 'org/a'],
    )

    const final = db.query(`SELECT last_conclusion, last_run_id FROM ci_run_states WHERE repo_full_name = ?`).get('org/a') as { last_conclusion: string, last_run_id: number }
    expect(final.last_conclusion).toBe('failure')
    expect(final.last_run_id).toBe(101)

    db.close()
  })

  test('mark-notified bumps last_notified_at without touching other columns', () => {
    const db = new Database(':memory:')
    applyCiNotificationsMigrations(db)
    db.run(
      `INSERT INTO ci_run_states (repo_full_name, last_conclusion, last_run_id) VALUES ('org/a', 'failure', 200)`,
    )

    db.run(`UPDATE ci_run_states SET last_notified_at = ? WHERE repo_full_name = ?`, ['2026-05-20T12:05:00Z', 'org/a'])

    const row = db.query(`SELECT last_conclusion, last_run_id, last_notified_at FROM ci_run_states WHERE repo_full_name = ?`).get('org/a') as { last_conclusion: string, last_run_id: number, last_notified_at: string }
    expect(row.last_conclusion).toBe('failure')
    expect(row.last_run_id).toBe(200)
    expect(row.last_notified_at).toBe('2026-05-20T12:05:00Z')

    db.close()
  })
})
