/**
 * The ordinal band reserved for a discovered package's migrations.
 *
 * Nothing stages package migrations yet. These guards land first on purpose:
 * every one of them is a place that would renumber or delete a staged file the
 * moment one existed, and installing them afterwards would mean shipping a
 * window in which a package's schema could be deleted by the application's own
 * generator.
 *
 * All four are no-ops on a corpus with no band files, which is every corpus
 * today, so this is inert until the staging change arrives.
 */
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isPackageMigration, PACKAGE_MIGRATION_BAND, stagePackageMigrations } from '../src/package-migrations'

describe('the reserved package migration band', () => {
  test('is ten digits, so lexicographic order still equals numeric order', () => {
    // Run order is `readdirSync().sort()` on the basename. An eleven-digit
    // ordinal would sort before a ten-digit one and the band would invert.
    expect(String(PACKAGE_MIGRATION_BAND)).toHaveLength(10)
    expect(String(PACKAGE_MIGRATION_BAND).padStart(10, '0')).toBe('9000000000')
  })

  test('sorts after every plausible application ordinal', () => {
    const app = String(999_999).padStart(10, '0')
    const pkg = String(PACKAGE_MIGRATION_BAND + 1).padStart(10, '0')

    expect([`${pkg}-loghq.sql`, `${app}-create-users-table.sql`].sort())
      .toEqual([`${app}-create-users-table.sql`, `${pkg}-loghq.sql`])
  })

  test('recognises a file in the band', () => {
    expect(isPackageMigration('9000000001-loghq__create-log-entries-table.sql')).toBe(true)
    expect(isPackageMigration('9999999999-bughq__create-issues-table.sql')).toBe(true)
  })

  test('leaves every application migration alone', () => {
    expect(isPackageMigration('0000000001-create-users-table.sql')).toBe(false)
    expect(isPackageMigration('0000000133-add-orthomosaic-to-missions.sql')).toBe(false)
    expect(isPackageMigration('8999999999-still-the-application.sql')).toBe(false)
  })

  test('is not fooled by a filename carrying no ordinal', () => {
    // The corpus has always been ordinal-prefixed, but a hand-written file or
    // a stray `.sql` must not be mistaken for a package's and made undeletable.
    expect(isPackageMigration('create-users-table.sql')).toBe(false)
    expect(isPackageMigration('README.md')).toBe(false)
    expect(isPackageMigration('')).toBe(false)
  })
})

/**
 * Staging a package's migrations into the corpus that runs.
 *
 * The migration runner treats its corpus as writable - SQLite preprocessing
 * calls `unlinkSync` on duplicates and on statements the dialect cannot run -
 * so a package's own directory is copied out of rather than run in place.
 */
describe('staging a package migration', () => {
  function project(): string {
    return mkdtempSync(join(tmpdir(), 'stacks-stage-'))
  }

  /** Write `.sql` files into a package's migrations directory. */
  function shipped(root: string, pkg: string, files: Record<string, string>): { package: string, dir: string } {
    const dir = join(root, 'node_modules', pkg, 'database/migrations')
    mkdirSync(dir, { recursive: true })
    for (const [name, sql] of Object.entries(files))
      writeFileSync(join(dir, name), sql)
    return { package: pkg, dir }
  }

  test('copies the package files in under a banded name', () => {
    const root = project()
    try {
      const corpusDir = join(root, 'database/migrations')
      mkdirSync(corpusDir, { recursive: true })
      const loghq = shipped(root, 'loghq', {
        '0000000001-create-log-entries-table.sql': 'CREATE TABLE log_entries (id INTEGER);',
      })

      const staged = stagePackageMigrations({ roots: [loghq], corpusDir })

      expect(staged).toHaveLength(1)
      expect(staged[0]?.name).toBe('9000000000-loghq__0000000001-create-log-entries-table.sql')
      expect(readFileSync(join(corpusDir, staged[0]!.name), 'utf8'))
        .toBe('CREATE TABLE log_entries (id INTEGER);')
      expect(isPackageMigration(staged[0]!.name)).toBe(true)
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('runs after the application, and in each package\'s own declared order', () => {
    const root = project()
    try {
      const corpusDir = join(root, 'database/migrations')
      mkdirSync(corpusDir, { recursive: true })
      writeFileSync(join(corpusDir, '0000000133-add-orthomosaic.sql'), '')

      stagePackageMigrations({
        roots: [
          shipped(root, 'loghq', { '0000000001-create.sql': 'a', '0000000002-alter.sql': 'b' }),
          shipped(root, 'bughq', { '0000000001-issues.sql': 'c' }),
        ],
        corpusDir,
      })

      // This ordering IS the run order. A package's tables carry foreign keys
      // into the application's and never the reverse, and `create` before
      // `alter` is not something alphabetical order preserves on its own.
      expect(readdirSync(corpusDir).sort()).toEqual([
        '0000000133-add-orthomosaic.sql',
        '9000000000-bughq__0000000001-issues.sql',
        '9000000000-loghq__0000000001-create.sql',
        '9000000000-loghq__0000000002-alter.sql',
      ])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('names a package file the same whatever else is installed', () => {
    // The ledger keys on the bare basename. An ordinal handed out by position
    // would rename loghq's files the moment bughq was installed, and every one
    // of them would read as new and run again against tables it had created.
    const root = project()
    try {
      const corpusDir = join(root, 'database/migrations')
      mkdirSync(corpusDir, { recursive: true })
      const loghq = shipped(root, 'loghq', { '0000000001-create.sql': 'a' })

      const alone = stagePackageMigrations({ roots: [loghq], corpusDir })
      const alongside = stagePackageMigrations({
        roots: [shipped(root, 'bughq', { '0000000001-issues.sql': 'c' }), loghq],
        corpusDir,
      })

      expect(alongside.find(s => s.package === 'loghq')?.name).toBe(alone[0]?.name)
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('leaves an unchanged file alone rather than rewriting it', () => {
    const root = project()
    try {
      const corpusDir = join(root, 'database/migrations')
      mkdirSync(corpusDir, { recursive: true })
      const loghq = shipped(root, 'loghq', { '0000000001-create.sql': 'CREATE TABLE a (id INT);' })

      const [first] = stagePackageMigrations({ roots: [loghq], corpusDir })
      const target = join(corpusDir, first!.name)
      const past = new Date(Date.now() - 60_000)
      utimesSync(target, past, past)
      const before = statSync(target).mtimeMs

      stagePackageMigrations({ roots: [loghq], corpusDir })

      // The corpus is a directory other things watch, and migrate runs often.
      expect(statSync(target).mtimeMs).toBe(before)
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('republishes a file the package changed', () => {
    const root = project()
    try {
      const corpusDir = join(root, 'database/migrations')
      mkdirSync(corpusDir, { recursive: true })
      shipped(root, 'loghq', { '0000000001-create.sql': 'CREATE TABLE a (id INT);' })
      const loghq = { package: 'loghq', dir: join(root, 'node_modules/loghq/database/migrations') }
      stagePackageMigrations({ roots: [loghq], corpusDir })

      writeFileSync(join(loghq.dir, '0000000001-create.sql'), 'CREATE TABLE a (id INT, name TEXT);')
      const [again] = stagePackageMigrations({ roots: [loghq], corpusDir })

      // So a fresh database builds what the installed version describes. An
      // existing database does NOT re-run it - the ledger has this basename.
      expect(readFileSync(join(corpusDir, again!.name), 'utf8')).toContain('name TEXT')
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('a package with no migrations directory contributes nothing', () => {
    const root = project()
    try {
      const corpusDir = join(root, 'database/migrations')
      mkdirSync(corpusDir, { recursive: true })

      expect(stagePackageMigrations({
        roots: [{ package: 'table', dir: join(root, 'node_modules/table/database/migrations') }],
        corpusDir,
      })).toEqual([])
      expect(readdirSync(corpusDir)).toEqual([])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
})
