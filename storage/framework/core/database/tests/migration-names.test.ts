import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  duplicateMigrationOrdinals,
  duplicateMigrationOrdinalsIn,
  nextMigrationOrdinal,
  retiredMigrationNames,
} from '../src/migration-names'

const pad = (n: number, label: string) => `${String(n).padStart(10, '0')}-${label}.sql`
const range = (from: number, to: number, label: string) => Array.from({ length: to - from + 1 }, (_, i) => pad(from + i, `${label}-${from + i}`))

describe('nextMigrationOrdinal', () => {
  test('numbers from the files on disk when nothing else is claimed', () => {
    expect(nextMigrationOrdinal(range(1, 3, 'x'))).toBe(4)
    expect(nextMigrationOrdinal([])).toBe(1)
  })

  // HQ.training: a 79-file rebuilt corpus that had grown to 103, against a
  // production ledger still holding the old corpus's 1-137. Numbering from the
  // files alone produced `0000000104-alter-organizations-columns.sql`, a name
  // the ledger already had, so `migrate` would have skipped it.
  test('continues after a pre-rebuild ledger instead of walking back through it', () => {
    const disk = range(1, 103, 'new')
    const ledger = [...range(1, 137, 'old'), pad(104, 'alter-organizations-columns'), ...disk]
    const next = nextMigrationOrdinal(disk, ledger)
    expect(next).toBe(138)
    expect(ledger).not.toContain(pad(next, 'alter-organizations-columns'))
  })

  test('the ledger raises the floor even when it has gaps', () => {
    expect(nextMigrationOrdinal(range(1, 2, 'x'), [pad(3, 'a'), pad(7, 'b')])).toBe(8)
  })

  test('a timestamp-named ledger row is reserved but does not renumber everything after it', () => {
    const claimed = ['1784267334-create-leads-table.sql', '1785502251845-create-pledges-table.sql']
    expect(nextMigrationOrdinal(range(1, 5, 'x'), claimed)).toBe(6)
    // A corpus that is itself numbered by time keeps sorting after its last file.
    expect(nextMigrationOrdinal(['1784267334-create-leads-table.sql'], [])).toBe(1784267335)
    expect(nextMigrationOrdinal(['1784267334-create-leads-table.sql'], ['1784267335-create-x-table.sql'])).toBe(1784267336)
  })

  test('package migrations stay out of the count on both sides', () => {
    expect(nextMigrationOrdinal([...range(1, 4, 'x'), '9000000001-pkg-create-a.sql'], ['9999999999-coach-athletes-unique-indexes.sql'])).toBe(5)
  })
})

describe('duplicateMigrationOrdinals', () => {
  test('groups the files that share a number, in run order', () => {
    expect(duplicateMigrationOrdinals([
      pad(1, 'create-a-table'),
      pad(2, 'create-b-table'),
      pad(2, 'alter-a-columns'),
      pad(3, 'create-c-table'),
      'README.md',
    ])).toEqual([{ ordinal: '0000000002', files: [pad(2, 'alter-a-columns'), pad(2, 'create-b-table')] }])
    expect(duplicateMigrationOrdinals(range(1, 5, 'x'))).toEqual([])
  })

  test('marks a group a generator wrote into', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-duplicate-ordinals-'))
    try {
      writeFileSync(join(dir, pad(5, 'create-a-table')), 'CREATE TABLE a (id INTEGER);\n')
      writeFileSync(join(dir, pad(5, 'create-b-table')), 'CREATE TABLE b (id INTEGER);\n')
      writeFileSync(join(dir, pad(6, 'create-c-table')), '-- qb:generated\nCREATE TABLE c (id INTEGER);\n')
      writeFileSync(join(dir, pad(6, 'alter-c-columns')), '-- qb:generated\nALTER TABLE c ADD COLUMN x INTEGER;\n')
      expect(duplicateMigrationOrdinalsIn(dir).map(group => [group.ordinal, group.generated])).toEqual([['0000000005', false], ['0000000006', true]])
      expect(duplicateMigrationOrdinalsIn(join(dir, 'missing'))).toEqual([])
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('retiredMigrationNames', () => {
  test('lists every name the corpus dropped, a renamed file\'s old name included', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-retired-migrations-'))
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
    }
    try {
      const dir = join(root, 'database/migrations')
      mkdirSync(dir, { recursive: true })
      git('init', '-q')
      git('config', 'user.email', 'test@example.com')
      git('config', 'user.name', 'Test')
      git('config', 'commit.gpgsign', 'false')
      writeFileSync(join(dir, pad(1, 'create-a-table')), 'CREATE TABLE a (id INTEGER);\n')
      writeFileSync(join(dir, pad(2, 'create-b-table')), 'CREATE TABLE b (id INTEGER);\n')
      writeFileSync(join(root, 'unrelated.sql'), 'SELECT 1;\n')
      git('add', '-A', '-f')
      git('commit', '-q', '-m', 'one')
      // Before anything is dropped there is nothing to report.
      expect(retiredMigrationNames(dir)).toEqual([])

      git('mv', `database/migrations/${pad(1, 'create-a-table')}`, `database/migrations/${pad(3, 'create-a-table')}`)
      git('rm', '-q', `database/migrations/${pad(2, 'create-b-table')}`, 'unrelated.sql')
      git('commit', '-q', '-m', 'two')
      expect(retiredMigrationNames(dir)).toEqual([pad(1, 'create-a-table'), pad(2, 'create-b-table')])

      // Put back exactly as it was (a reverted commit, restored): the same
      // migration under its own name, not a reuse.
      writeFileSync(join(dir, pad(2, 'create-b-table')), 'CREATE TABLE b (id INTEGER);\n')
      git('add', '-A', '-f')
      git('commit', '-q', '-m', 'three')
      expect(retiredMigrationNames(dir)).toEqual([pad(1, 'create-a-table')])

      // A different migration taking a dropped name is a reuse.
      writeFileSync(join(dir, pad(1, 'create-a-table')), 'CREATE TABLE c (id INTEGER);\n')
      git('add', '-A', '-f')
      git('commit', '-q', '-m', 'four')
      expect(retiredMigrationNames(dir)).toEqual([pad(1, 'create-a-table')])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('outside a git checkout it answers nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-retired-nogit-'))
    try {
      expect(retiredMigrationNames(dir)).toEqual([])
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  })

  test('an identical latest restoration never forgets an older different migration under the same name', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-retired-multiple-deletions-'))
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
    }
    try {
      const dir = join(root, 'database/migrations')
      mkdirSync(dir, { recursive: true })
      git('init', '-q')
      git('config', 'user.email', 'test@example.com')
      git('config', 'user.name', 'Test')
      git('config', 'commit.gpgsign', 'false')
      const name = pad(1, 'create-a-table')
      const file = join(dir, name)
      for (const [index, sql] of ['CREATE TABLE a (id INTEGER);\n', 'CREATE TABLE b (id INTEGER);\n'].entries()) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(file, sql)
        git('add', '-A', '-f')
        git('commit', '-q', '-m', `corpus ${index}`)
        git('rm', '-q', `database/migrations/${name}`)
        git('commit', '-q', '-m', `drop corpus ${index}`)
      }
      // This really is identical to the latest deleted file, but a database
      // can still have recorded the older SQL under this filename.
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, 'CREATE TABLE b (id INTEGER);\n')
      git('add', '-A', '-f')
      git('commit', '-q', '-m', 'restore latest corpus')
      expect(retiredMigrationNames(dir)).toEqual([name])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
})

for (const objectFormat of ['sha1', 'sha256']) {
  test(`restoration compares raw bytes and unquoted paths in ${objectFormat} repositories`, () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-retired-blob-format-'))
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
    }
    try {
      const dir = join(root, 'database/migrations')
      mkdirSync(dir, { recursive: true })
      git('init', '-q', `--object-format=${objectFormat}`)
      git('config', 'user.email', 'test@example.com')
      git('config', 'user.name', 'Test')
      git('config', 'commit.gpgsign', 'false')
      const name = pad(1, 'migration with spaces ü')
      const file = join(dir, name)
      const original = new Uint8Array([45, 45, 32, 255, 10])
      writeFileSync(file, original)
      git('add', '-A', '-f')
      git('commit', '-q', '-m', 'original bytes')
      git('rm', '-q', `database/migrations/${name}`)
      git('commit', '-q', '-m', 'drop original bytes')
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, original)
      expect(retiredMigrationNames(dir)).toEqual([])
      // Both invalid byte sequences decode to the same UTF8 replacement
      // character. They must still be different migration artifacts.
      writeFileSync(file, new Uint8Array([45, 45, 32, 254, 10]))
      expect(retiredMigrationNames(dir)).toEqual([name])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
}

// Real generation in a disposable app, against a SQLite ledger and a git history.
test('generate:migrations never writes a name the ledger or the corpus history already holds', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-generated-names-'))
  try {
    const config = join(root, 'bunfig.toml')
    writeFileSync(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/generated-migration-names.ts`], {
      cwd: root,
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'app.sqlite'), STACKS_GENERATED_NAMES_ROOT: root },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 50_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('generated migration names OK')
    }
    finally {
      clearTimeout(watchdog)
      child.kill()
    }
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 60_000)
