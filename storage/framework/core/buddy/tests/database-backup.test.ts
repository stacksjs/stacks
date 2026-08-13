/**
 * The dump that stands between a bad migration and the only copy of an app's
 * data (stacksjs/stacks#2313).
 *
 * `buddy deploy` runs `migrate` against production on every release. #2318 made
 * the framework say that nothing was backing it up; this covers the half that
 * does something about it - the pre-migration dump, its retention, and the
 * restore path.
 *
 * The SQLite round-trip is a REAL one: rows are written, dumped, destroyed, and
 * read back. A backup nobody has ever restored is a hypothesis, so a test that
 * only checked a file appeared would be testing the same hypothesis.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  backupFileName,
  dumpCommand,
  dumpSqlite,
  isBackupFileName,
  prunableBackups,
  resolveBackupTarget,
  restoreCommand,
  restoreSqlite,
  toolFailureDetail,
  withoutPassword,
} from '../src/database-backup'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stacks-2313-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function sqliteConfig(database: string): unknown {
  return { default: 'sqlite', connections: { sqlite: { database } } }
}

describe('which database a dump is taken of', () => {
  it('reads SQLite out of the connection the app actually opens', () => {
    expect(resolveBackupTarget(sqliteConfig('database/stacks.sqlite'))).toEqual({
      engine: 'sqlite',
      database: 'database/stacks.sqlite',
    })
  })

  it('reads a server engine with its credentials', () => {
    const target = resolveBackupTarget({
      default: 'postgres',
      connections: { postgres: { name: 'app', host: 'db.internal', port: 6543, username: 'app', password: 'hunter2' } },
    })

    expect(target).toEqual({
      engine: 'postgres',
      database: 'app',
      host: 'db.internal',
      port: 6543,
      username: 'app',
      password: 'hunter2',
    })
  })

  it('treats mariadb as mysql, because that is the wire protocol and the tool', () => {
    expect(resolveBackupTarget({ default: 'mariadb', connections: { mariadb: { name: 'app' } } })?.engine).toBe('mysql')
  })

  it('refuses vitess rather than take a dump that would not restore', () => {
    // A `mysqldump` through a vtgate is not a restorable backup of a sharded
    // keyspace. Producing one would look like a backup right up to the restore,
    // which is worse than producing nothing.
    expect(resolveBackupTarget({ default: 'vitess', connections: { vitess: { name: 'app' } } })).toBeNull()
  })

  it('refuses an engine it has no dump tool for at all', () => {
    expect(resolveBackupTarget({ default: 'dynamodb', connections: { dynamodb: {} } })).toBeNull()
  })

  it('survives a config with nothing in it', () => {
    // Runs inside a deploy. Throwing here would fail the release rather than
    // the backup.
    expect(resolveBackupTarget(undefined)).toBeNull()
    expect(resolveBackupTarget({})).toBeNull()
    expect(resolveBackupTarget({ default: 'sqlite', connections: {} })).toBeNull()
    expect(resolveBackupTarget({ default: 'sqlite', connections: { sqlite: { database: '' } } })).toBeNull()
  })
})

describe('the dump command', () => {
  const target = resolveBackupTarget({
    default: 'postgres',
    connections: { postgres: { name: 'app', host: '10.0.0.5', port: 5432, username: 'app', password: 's3cret' } },
  })!

  it('keeps the password out of argv, where every user on the box could read it', () => {
    const command = dumpCommand(target, '/backups/x.sql')!

    expect(command.args.join(' ')).not.toContain('s3cret')
    expect(command.env.PGPASSWORD).toBe('s3cret')
  })

  it('connects as the application user, so no superuser rule has to be copied here', () => {
    // ts-cloud encodes pantry's postgres trust/md5 asymmetry in an unexported
    // `pgAdminCommand()`. Dumping the one database the app owns, as the app,
    // needs none of it.
    const command = dumpCommand(target, '/backups/x.sql')!

    expect(command.bin).toBe('pg_dump')
    expect(command.args).toContain('app')
    expect(command.args).not.toContain('postgres')
  })

  it('drops ownership and ACLs, so the dump restores onto a fresh box', () => {
    const command = dumpCommand(target, '/backups/x.sql')!

    expect(command.args).toContain('--no-owner')
    expect(command.args).toContain('--no-acl')
  })

  it('dumps mysql in one transaction rather than table by table', () => {
    const mysql = resolveBackupTarget({ default: 'mysql', connections: { mysql: { name: 'app', password: 'pw' } } })!
    const command = dumpCommand(mysql, '/backups/x.sql')!

    expect(command.bin).toBe('mysqldump')
    expect(command.args).toContain('--single-transaction')
    expect(command.env.MYSQL_PWD).toBe('pw')
    expect(command.args.join(' ')).not.toContain('pw')
  })

  it('has no external command for SQLite, which is copied in-process', () => {
    expect(dumpCommand({ engine: 'sqlite', database: 'a.sqlite' }, '/b.sqlite')).toBeNull()
  })

  it('stops a postgres restore at the first error instead of half-applying it', () => {
    const command = restoreCommand(target, '/backups/x.sql')!

    expect(command.bin).toBe('psql')
    expect(command.args.join(' ')).toContain('ON_ERROR_STOP=1')
  })
})

describe('a SQLite backup, taken and put back', () => {
  it('restores the rows that were there when it was taken', async () => {
    const live = join(dir, 'app.sqlite')
    const dump = join(dir, 'dump.sqlite')

    const database = new Database(live)
    database.exec('CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT)')
    database.exec(`INSERT INTO customers (email) VALUES ('a@example.com'), ('b@example.com')`)
    database.close()

    await dumpSqlite(live, dump)
    expect(existsSync(dump)).toBe(true)

    // The migration from hell: the table is gone.
    const wrecked = new Database(live)
    wrecked.exec('DROP TABLE customers')
    wrecked.close()

    const displaced = await restoreSqlite(dump, live, 1)
    expect(displaced).toBe(`${live}.replaced-1`)

    const restored = new Database(live, { readonly: true })
    const rows = restored.query('SELECT email FROM customers ORDER BY email').all() as { email: string }[]
    restored.close()

    expect(rows.map(r => r.email)).toEqual(['a@example.com', 'b@example.com'])
  })

  it('keeps the database it replaced, because restoring the wrong dump happens', async () => {
    const live = join(dir, 'app.sqlite')
    const dump = join(dir, 'dump.sqlite')

    const database = new Database(live)
    database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)')
    database.close()
    await dumpSqlite(live, dump)

    const displaced = await restoreSqlite(dump, live, 99)

    expect(displaced).toBe(`${live}.replaced-99`)
    expect(existsSync(displaced!)).toBe(true)
  })

  it('restores onto a box that has no database yet', async () => {
    const live = join(dir, 'fresh.sqlite')
    const source = join(dir, 'seed.sqlite')

    const database = new Database(source)
    database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)')
    database.close()

    expect(await restoreSqlite(source, live, 1)).toBeNull()
    expect(existsSync(live)).toBe(true)
  })

  it('will not quietly overwrite an existing dump', async () => {
    const live = join(dir, 'app.sqlite')
    const dump = join(dir, 'dump.sqlite')

    const database = new Database(live)
    database.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)')
    database.close()

    await dumpSqlite(live, dump)

    // Two dumps in the same second must not silently become one.
    await expect(dumpSqlite(live, dump)).rejects.toThrow()
  })
})

describe('naming and retention', () => {
  const target = { engine: 'sqlite' as const, database: 'app.sqlite' }

  it('names dumps so that sorting them by name sorts them by time', () => {
    const older = backupFileName(target, new Date('2026-08-13T09:00:00.000Z'))
    const newer = backupFileName(target, new Date('2026-08-13T10:00:00.000Z'))

    expect([newer, older].sort()).toEqual([older, newer])
  })

  it('recognises its own file names and nothing else', () => {
    expect(isBackupFileName(backupFileName(target, new Date('2026-08-13T09:00:00.000Z')))).toBe(true)
    expect(isBackupFileName('notes.txt')).toBe(false)
    expect(isBackupFileName('app.sqlite')).toBe(false)
    // The file a restore moved aside is not itself a backup to be pruned.
    expect(isBackupFileName('app.sqlite.replaced-1')).toBe(false)
  })

  it('prunes the oldest and keeps exactly the retained count', () => {
    const names = ['1', '2', '3', '4', '5'].map((_, i) =>
      backupFileName(target, new Date(Date.UTC(2026, 7, 13, 9 + i))))

    expect(prunableBackups(names, 2)).toEqual([names[0], names[1], names[2]])
    expect(prunableBackups(names, 5)).toEqual([])
    expect(prunableBackups(names, 99)).toEqual([])
  })

  it('never prunes when retention is nonsense, rather than deleting everything', () => {
    // `--retain notanumber` parses to NaN. Treating that as "keep 0" would make
    // a typo delete every backup the app has.
    const names = [backupFileName(target, new Date('2026-08-13T09:00:00.000Z'))]

    expect(prunableBackups(names, Number.NaN)).toEqual([])
    expect(prunableBackups(names, 0)).toEqual([])
    expect(prunableBackups(names, -1)).toEqual([])
  })

  it('ignores files it did not write when deciding what to delete', () => {
    const mine = backupFileName(target, new Date('2026-08-13T09:00:00.000Z'))

    expect(prunableBackups(['README', 'app.sqlite', mine], 1)).toEqual([])
  })
})

describe('what the operator is told when a dump fails', () => {
  it('leads with the error line, not the last line', () => {
    // Measured against a live Postgres: taking the last line alone reported
    // only the version numbers and dropped "server version mismatch".
    const stderr = [
      'pg_dump: error: aborting because of server version mismatch',
      'pg_dump: detail: server version: 17.10; pg_dump version: 16.14 (Homebrew)',
    ].join('\n')

    const detail = toolFailureDetail(stderr, 'pg_dump')

    expect(detail).toContain('aborting because of server version mismatch')
    expect(detail).toContain('17.10')
    // The caller adds its own `pg_dump: ` prefix.
    expect(detail.startsWith('pg_dump:')).toBe(false)
  })

  it('falls back to the last line when nothing says "error"', () => {
    expect(toolFailureDetail('connection refused', 'psql')).toBe('connection refused')
  })

  it('says nothing rather than something misleading when stderr is empty', () => {
    expect(toolFailureDetail('   \n\n', 'pg_dump')).toBe('')
  })

  it('never lets the password reach a log line', () => {
    expect(withoutPassword('psql: FATAL: password "hunter2" failed', 'hunter2'))
      .toBe('psql: FATAL: password "***" failed')
    expect(withoutPassword('no password here', '')).toBe('no password here')
    expect(withoutPassword('no password here', undefined)).toBe('no password here')
  })
})

describe('the directory a dump lands in', () => {
  it('lists only dumps, so a stray file cannot be restored by accident', () => {
    const target = { engine: 'sqlite' as const, database: 'app.sqlite' }
    const name = backupFileName(target, new Date('2026-08-13T09:00:00.000Z'))

    mkdirSync(join(dir, 'backups'))
    writeFileSync(join(dir, 'backups', name), '')
    writeFileSync(join(dir, 'backups', 'notes.txt'), '')

    const listed = ['notes.txt', name].filter(isBackupFileName)
    expect(listed).toEqual([name])
  })
})
